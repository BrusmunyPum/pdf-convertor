import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Job } from 'bullmq';
import { CONVERSION_QUEUE } from '../../common/constants';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { RealtimeService } from '../realtime/realtime.service';
import { publicJob } from './conversion.serializer';
import { ConverterClient, ConverterError } from './converter.client';
import { ownerOf } from './conversions.service';
import { jobOutputDir, readProgress } from './storage';

const FRIENDLY_ERRORS: Record<string, string> = {
  PASSWORD_REQUIRED: 'ឯកសារ PDF មានពាក្យសម្ងាត់ ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ',
  INVALID_PDF: 'ឯកសារ PDF ខូចខាត ឬមិនត្រឹមត្រូវ',
  CONVERTER_DOWN: 'ម៉ាស៊ីនបម្លែងមិនដំណើរការ',
};

const PROGRESS_POLL_MS = 600;
const PROGRESS_SAVE_MS = 3000;

/** Queue worker: runs one conversion at a time per slot and streams its progress to the owner. */
@Processor(CONVERSION_QUEUE, { concurrency: env.queueConcurrency })
export class ConversionsProcessor extends WorkerHost {
  private readonly log = new Logger(ConversionsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly converter: ConverterClient,
    private readonly credits: CreditsService,
    private readonly realtime: RealtimeService,
  ) {
    super();
  }

  async process(bull: Job<{ jobId: string; password: string | null }>) {
    const queued = await this.prisma.conversionJob.findUnique({ where: { id: bull.data.jobId } });
    if (!queued || queued.status !== 'QUEUED') return;
    const job = await this.prisma.conversionJob.update({
      where: { id: queued.id },
      data: { status: 'PROCESSING', startedAt: new Date(), progress: 5 },
    });
    const owner = ownerOf(job);
    this.realtime.jobUpdated(owner, publicJob(job, { stage: 'Starting' }));

    const stopWatching = this.watchProgress(job.id, (progress, stage) =>
      this.realtime.jobUpdated(owner, publicJob(job, { progress, stage })),
    );
    try {
      const res = await this.converter.convert({
        jobId: job.id,
        inputPath: job.inputPath,
        outputDir: jobOutputDir(job.id),
        target: job.targetFormat,
        baseName: job.originalName.replace(/\.pdf$/i, '') || 'converted',
        options: { ...(job.options as object), password: bull.data.password } as never,
      });
      stopWatching();
      const done = await this.prisma.conversionJob.update({
        where: { id: job.id },
        data: {
          status: 'COMPLETED',
          progress: 100,
          outputPath: res.outputPath,
          outputName: res.fileName,
          outputSize: res.size,
          warnings: res.warnings as Prisma.InputJsonValue,
          quality: res.quality as Prisma.InputJsonValue,
          durationMs: res.durationMs,
          finishedAt: new Date(),
        },
      });
      this.realtime.jobUpdated(owner, publicJob(done));
    } catch (err) {
      stopWatching();
      const code = err instanceof ConverterError ? err.code : 'CONVERSION_FAILED';
      this.log.warn(`job ${job.id} failed: ${code} ${(err as Error).message}`);
      const failed = await this.prisma.conversionJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: FRIENDLY_ERRORS[code] ?? 'ការបម្លែងបរាជ័យ។ ក្រេឌីតត្រូវបានបង្វិលសងវិញ។', finishedAt: new Date() },
      });
      await this.credits.refund(failed);
      this.realtime.jobUpdated(owner, publicJob({ ...failed, creditsCharged: 0 }));
    }
  }

  /** Poll the converter's progress file; push changes live, save them now and then. */
  private watchProgress(jobId: string, onChange: (progress: number, stage?: string) => void) {
    let last = -1;
    let lastStage: string | undefined;
    let lastSaved = 0;
    const timer = setInterval(async () => {
      const p = await readProgress(jobId);
      if (!p || (p.progress === last && p.message === lastStage)) return;
      last = p.progress;
      lastStage = p.message;
      onChange(p.progress, p.message);
      if (Date.now() - lastSaved > PROGRESS_SAVE_MS) {
        lastSaved = Date.now();
        await this.prisma.conversionJob.update({ where: { id: jobId }, data: { progress: p.progress } }).catch(() => undefined);
      }
    }, PROGRESS_POLL_MS);
    return () => clearInterval(timer);
  }
}
