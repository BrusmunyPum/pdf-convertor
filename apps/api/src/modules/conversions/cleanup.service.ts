import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { RealtimeService } from '../realtime/realtime.service';
import { publicJob } from './conversion.serializer';
import { ConversionsService, ownerOf } from './conversions.service';

@Injectable()
export class CleanupService {
  private readonly log = new Logger(CleanupService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly conversions: ConversionsService,
    private readonly credits: CreditsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Delete expired files every hour (history rows stay). */
  @Cron(CronExpression.EVERY_HOUR)
  async purgeExpired() {
    const expired = await this.prisma.conversionJob.findMany({
      where: { expiresAt: { lt: new Date() }, filesDeleted: false, status: { in: ['COMPLETED', 'FAILED'] } },
      take: 500,
    });
    for (const job of expired) await this.conversions.deleteFiles(job);
    if (expired.length) this.log.log(`purged files of ${expired.length} jobs`);
  }

  /** Jobs stuck in PROCESSING (e.g. API restarted mid-conversion) fail and are refunded. */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async failStuck() {
    const stuck = await this.prisma.conversionJob.findMany({
      where: { status: 'PROCESSING', startedAt: { lt: new Date(Date.now() - 30 * 60_000) } },
    });
    for (const job of stuck) {
      const failed = await this.prisma.conversionJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', error: 'ការបម្លែងយូរពេក។ ក្រេឌីតត្រូវបានបង្វិលសងវិញ។', finishedAt: new Date() },
      });
      await this.credits.refund(failed);
      this.realtime.jobUpdated(ownerOf(failed), publicJob({ ...failed, creditsCharged: 0 }));
    }
  }
}
