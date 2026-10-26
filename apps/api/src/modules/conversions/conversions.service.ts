import { InjectQueue } from '@nestjs/bullmq';
import { HttpStatus, Injectable } from '@nestjs/common';
import { ConversionJob, Prisma } from '@prisma/client';
import archiver from 'archiver';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { existsSync, promises as fs } from 'fs';
import * as path from 'path';
import { CONVERSION_QUEUE, FORMATS } from '../../common/constants';
import { AppError } from '../../common/errors/app-error';
import { Identity } from '../../common/types/identity';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { Owner, RealtimeService } from '../realtime/realtime.service';
import { SettingsService } from '../settings/settings.service';
import { publicJob } from './conversion.serializer';
import { ConverterClient, ConverterError, ConvertOptions } from './converter.client';
import { jobDir, jobInput, readProgress, removeJobFiles } from './storage';

const INSPECT_ERRORS: Record<string, string> = {
  PASSWORD_REQUIRED: 'ឯកសារ PDF នេះមានពាក្យសម្ងាត់។ សូមបញ្ចូលពាក្យសម្ងាត់ ហើយព្យាយាមម្ដងទៀត។',
  INVALID_PDF: 'ឯកសារនេះមិនមែនជា PDF ត្រឹមត្រូវ ឬខូចខាត។',
};

export interface UploadedPdf {
  path: string;
  size: number;
  originalname: string;
}

interface NewJob {
  id: string;
  inputPath: string;
  inputSize: number;
  originalName: string;
  pageCount: number;
  target: string;
  options: ConvertOptions;
}

export const ownerOf = (job: Pick<ConversionJob, 'userId' | 'guestId'>): Owner => ({ userId: job.userId, guestId: job.guestId });

@Injectable()
export class ConversionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly credits: CreditsService,
    private readonly converter: ConverterClient,
    private readonly realtime: RealtimeService,
    @InjectQueue(CONVERSION_QUEUE) private readonly queue: Queue,
  ) {}

  ownerFilter(identity: Identity): Prisma.ConversionJobWhereInput {
    return identity.user ? { userId: identity.user.id } : { guestId: identity.guestId, userId: null };
  }

  async findOwned(id: string, identity: Identity) {
    const job = await this.prisma.conversionJob.findUnique({ where: { id } });
    const isOwner =
      job &&
      ((identity.user && job.userId === identity.user.id) ||
        (!job.userId && job.guestId === identity.guestId) ||
        identity.user?.role === 'ADMIN');
    if (!job || !isOwner) throw new AppError('NOT_FOUND', 'រកមិនឃើញឯកសារនេះទេ', HttpStatus.NOT_FOUND);
    return job;
  }

  /** Validate an uploaded PDF, charge one conversion and queue it. */
  async create(identity: Identity, file: UploadedPdf, target: string, options: ConvertOptions) {
    const s = await this.settings.get();
    const cleanupTmp = () => fs.rm(file.path, { force: true });
    try {
      this.assertFormat(target);
      if (file.size > s.maxFileMb * 1024 * 1024) {
        throw new AppError('FILE_TOO_LARGE', `ឯកសារធំពេក។ ទំហំអតិបរមា ${s.maxFileMb}MB`, HttpStatus.PAYLOAD_TOO_LARGE);
      }
      if (!(await this.looksLikePdf(file.path))) throw new AppError('INVALID_PDF', INSPECT_ERRORS.INVALID_PDF);
      // quick credit check before doing any work (the real charge is transactional below)
      await this.credits.assertCanAfford(identity, s.creditCost);
    } catch (err) {
      await cleanupTmp();
      throw err;
    }

    const id = randomUUID();
    const inputPath = jobInput(id);
    await fs.mkdir(jobDir(id), { recursive: true });
    await fs.rename(file.path, inputPath).catch(async () => {
      await fs.copyFile(file.path, inputPath);
      await cleanupTmp();
    });

    let pages = 0;
    try {
      pages = (await this.converter.inspect(inputPath, options.password)).pages;
    } catch (err) {
      await removeJobFiles(id);
      if (err instanceof ConverterError) {
        throw new AppError(err.code, INSPECT_ERRORS[err.code] ?? 'មិនអាចអានឯកសារ PDF នេះបានទេ', HttpStatus.UNPROCESSABLE_ENTITY);
      }
      throw err;
    }
    if (pages > s.maxPages) {
      await removeJobFiles(id);
      throw new AppError('TOO_MANY_PAGES', `ឯកសារមានទំព័រច្រើនពេក (${pages})។ អតិបរមា ${s.maxPages} ទំព័រ`);
    }

    return this.enqueue(identity, { id, inputPath, inputSize: file.size, originalName: file.originalname, pageCount: pages, target, options });
  }

  /** Convert an already-uploaded PDF again into another format (no re-upload). */
  async reconvert(sourceId: string, identity: Identity, target: string, options: ConvertOptions) {
    const src = await this.findOwned(sourceId, identity);
    if (src.filesDeleted || !existsSync(src.inputPath)) {
      throw new AppError('EXPIRED', 'ឯកសារដើមត្រូវបានលុបហើយ (ផុតកំណត់)។ សូមផ្ទុកឡើងម្ដងទៀត។', HttpStatus.GONE);
    }
    this.assertFormat(target);
    const id = randomUUID();
    const inputPath = jobInput(id);
    await fs.mkdir(jobDir(id), { recursive: true });
    await fs.link(src.inputPath, inputPath).catch(() => fs.copyFile(src.inputPath, inputPath));
    return this.enqueue(identity, {
      id,
      inputPath,
      inputSize: src.inputSize,
      originalName: src.originalName,
      pageCount: src.pageCount,
      target,
      options: { ...options, password: options.password ?? null },
    });
  }

  private async enqueue(identity: Identity, j: NewJob) {
    const s = await this.settings.get();
    const ttlHours = identity.user ? s.userFileTtlHours : s.guestFileTtlHours;
    let job: ConversionJob;
    try {
      job = await this.prisma.$transaction(async (tx) => {
        await this.credits.charge(tx, identity, s.creditCost, j.id);
        return tx.conversionJob.create({
          data: {
            id: j.id,
            userId: identity.user?.id ?? null,
            // the guest row only exists once a guest has converted; signed-in jobs belong to the user
            guestId: identity.user ? null : identity.guestId,
            ipHash: identity.ipHash,
            originalName: j.originalName.slice(0, 250),
            inputPath: j.inputPath,
            inputSize: j.inputSize,
            pageCount: j.pageCount,
            targetFormat: j.target,
            options: { ...j.options, password: j.options.password ? '***' : null } as Prisma.InputJsonValue,
            creditsCharged: s.creditCost,
            expiresAt: new Date(Date.now() + ttlHours * 3600 * 1000),
          },
        });
      });
    } catch (err) {
      await removeJobFiles(j.id);
      throw err;
    }
    // the password is only kept in the queue payload (Redis), never in Postgres
    await this.queue.add(
      'convert',
      { jobId: job.id, password: j.options.password ?? null },
      { jobId: job.id, attempts: 1, removeOnComplete: 1000, removeOnFail: 1000 },
    );
    const dto = publicJob(job);
    this.realtime.jobUpdated(ownerOf(job), dto);
    void this.credits.notify(ownerOf(job));
    return dto;
  }

  async withProgress(job: ConversionJob) {
    if (job.status !== 'PROCESSING') return publicJob(job);
    const p = await readProgress(job.id);
    return publicJob(job, p ? { progress: p.progress, stage: p.message } : undefined);
  }

  async remove(id: string, identity: Identity) {
    const job = await this.findOwned(id, identity);
    if (job.status === 'QUEUED' || job.status === 'PROCESSING') {
      throw new AppError('BUSY', 'កំពុងបម្លែង។ សូមរង់ចាំឲ្យរួចរាល់សិន។', HttpStatus.CONFLICT);
    }
    await removeJobFiles(job.id);
    await this.prisma.conversionJob.delete({ where: { id: job.id } });
    this.realtime.jobRemoved(ownerOf(job), job.id);
    return { ok: true };
  }

  async deleteFiles(job: ConversionJob) {
    await removeJobFiles(job.id);
    const updated = await this.prisma.conversionJob.update({ where: { id: job.id }, data: { filesDeleted: true } });
    this.realtime.jobUpdated(ownerOf(updated), publicJob(updated));
  }

  /** Stream several finished conversions as one ZIP (names made unique). */
  async streamArchive(ids: string[], identity: Identity, res: Response) {
    const jobs = await this.prisma.conversionJob.findMany({
      where: { id: { in: ids }, ...this.ownerFilter(identity), status: 'COMPLETED', filesDeleted: false },
      orderBy: { createdAt: 'asc' },
    });
    const files = jobs.filter((j) => j.outputPath && existsSync(j.outputPath));
    if (!files.length) throw new AppError('EXPIRED', 'គ្មានឯកសារដែលអាចទាញយកបានទេ', HttpStatus.GONE);

    const stamp = new Date().toISOString().slice(0, 10);
    res.attachment(`pdf-khmer-${stamp}.zip`);
    const zip = archiver('zip', { zlib: { level: 6 } });
    zip.on('error', () => res.destroy());
    zip.pipe(res);
    const used = new Set<string>();
    for (const j of files) {
      const name = j.outputName ?? path.basename(j.outputPath!);
      let unique = name;
      for (let n = 2; used.has(unique.toLowerCase()); n++) {
        const ext = path.extname(name);
        unique = `${path.basename(name, ext)} (${n})${ext}`;
      }
      used.add(unique.toLowerCase());
      zip.file(j.outputPath!, { name: unique });
    }
    await this.prisma.conversionJob.updateMany({ where: { id: { in: files.map((f) => f.id) } }, data: { downloadCount: { increment: 1 } } });
    await zip.finalize();
  }

  private assertFormat(target: string) {
    if (!FORMATS.includes(target as (typeof FORMATS)[number])) throw new AppError('BAD_FORMAT', 'ទម្រង់ឯកសារមិនត្រូវបានគាំទ្រ');
  }

  private async looksLikePdf(file: string) {
    const head = Buffer.alloc(1024);
    const fh = await fs.open(file, 'r');
    try {
      await fh.read(head, 0, 1024, 0);
    } finally {
      await fh.close();
    }
    return head.includes(Buffer.from('%PDF-'));
  }
}
