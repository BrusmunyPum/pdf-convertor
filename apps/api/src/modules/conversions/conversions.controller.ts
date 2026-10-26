import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { existsSync, mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { CurrentIdentity } from '../../common/decorators/auth.decorators';
import { paging } from '../../common/dto/pagination.dto';
import { AppError } from '../../common/errors/app-error';
import { Identity } from '../../common/types/identity';
import { PrismaService } from '../../prisma/prisma.service';
import { publicJob } from './conversion.serializer';
import { ConversionsService } from './conversions.service';
import { ArchiveQuery, ConvertDto, ListConversionsQuery } from './dto/conversion.dto';
import { TMP_DIR } from './storage';

/** Multer decodes multipart filenames as latin1; recover UTF-8 (Khmer) names. */
function fixFilename(name: string) {
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}

const uploadInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (_req, _file, cb) => {
      if (!existsSync(TMP_DIR)) mkdirSync(TMP_DIR, { recursive: true });
      cb(null, TMP_DIR);
    },
    filename: (_req, _file, cb) => cb(null, `${randomUUID()}.pdf`),
  }),
  limits: { fileSize: 200 * 1024 * 1024, files: 1 },
});

const options = (dto: ConvertDto) => ({ mode: dto.mode ?? 'flow', ocr: dto.ocr ?? 'auto', password: dto.password || null }) as const;

@Controller('conversions')
export class ConversionsController {
  constructor(
    private readonly service: ConversionsService,
    private readonly prisma: PrismaService,
  ) {}

  /** One PDF per request; the website uploads several files in parallel. */
  @Throttle({ default: { limit: 40, ttl: 60_000 } })
  @Post()
  @UseInterceptors(uploadInterceptor)
  create(@CurrentIdentity() id: Identity, @UploadedFile() file: Express.Multer.File | undefined, @Body() dto: ConvertDto) {
    if (!file) throw new AppError('NO_FILE', 'សូមជ្រើសរើសឯកសារ PDF');
    return this.service.create(
      id,
      { path: file.path, size: file.size, originalname: fixFilename(file.originalname) },
      dto.targetFormat,
      options(dto),
    );
  }

  @Get()
  async list(@CurrentIdentity() id: Identity, @Query() q: ListConversionsQuery) {
    const { page, take, skip } = paging(q);
    const where = {
      ...this.service.ownerFilter(id),
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.format ? { targetFormat: q.format } : {}),
      ...(q.q ? { originalName: { contains: q.q, mode: 'insensitive' as const } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.conversionJob.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.conversionJob.count({ where }),
    ]);
    return { items: items.map((j) => publicJob(j)), total, page, pageSize: take };
  }

  /** Several finished files as one ZIP: GET /conversions/archive?ids=a,b,c */
  @Get('archive')
  archive(@CurrentIdentity() id: Identity, @Query() q: ArchiveQuery, @Res() res: Response) {
    return this.service.streamArchive(q.ids, id, res);
  }

  @Get(':id')
  async get(@CurrentIdentity() id: Identity, @Param('id', ParseUUIDPipe) jobId: string) {
    return this.service.withProgress(await this.service.findOwned(jobId, id));
  }

  @Get(':id/download')
  async download(@CurrentIdentity() id: Identity, @Param('id', ParseUUIDPipe) jobId: string, @Res() res: Response) {
    const job = await this.service.findOwned(jobId, id);
    if (job.status !== 'COMPLETED' || job.filesDeleted || !job.outputPath || !existsSync(job.outputPath)) {
      throw new AppError('EXPIRED', 'ឯកសារនេះមិនមានទៀតទេ (ផុតកំណត់ ឬបរាជ័យ)', HttpStatus.GONE);
    }
    await this.prisma.conversionJob.update({ where: { id: job.id }, data: { downloadCount: { increment: 1 } } });
    res.download(job.outputPath, job.outputName ?? path.basename(job.outputPath));
  }

  @Post(':id/reconvert')
  reconvert(@CurrentIdentity() id: Identity, @Param('id', ParseUUIDPipe) jobId: string, @Body() dto: ConvertDto) {
    return this.service.reconvert(jobId, id, dto.targetFormat, options(dto));
  }

  @Delete(':id')
  remove(@CurrentIdentity() id: Identity, @Param('id', ParseUUIDPipe) jobId: string) {
    return this.service.remove(jobId, id);
  }
}
