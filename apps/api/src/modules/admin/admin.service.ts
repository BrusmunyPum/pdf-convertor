import { HttpStatus, Injectable } from '@nestjs/common';
import { CreditTxType } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { RealtimeEvent } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import { ReviewRequestDto } from './dto/admin.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly realtime: RealtimeService,
  ) {}

  async stats() {
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const [users, usersToday, jobs, jobsToday, completed, failed, pending, byFormat, daily, granted] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.conversionJob.count(),
      this.prisma.conversionJob.count({ where: { createdAt: { gte: dayStart } } }),
      this.prisma.conversionJob.count({ where: { status: 'COMPLETED' } }),
      this.prisma.conversionJob.count({ where: { status: 'FAILED' } }),
      this.prisma.creditRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.conversionJob.groupBy({ by: ['targetFormat'], _count: { _all: true } }),
      this.prisma.$queryRaw<{ day: Date; total: bigint; failed: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day,
               count(*) AS total,
               count(*) FILTER (WHERE status = 'FAILED') AS failed
        FROM "ConversionJob"
        WHERE "createdAt" > now() - interval '14 days'
        GROUP BY 1 ORDER BY 1`,
      this.prisma.creditTransaction.aggregate({
        where: { type: { in: [CreditTxType.REQUEST_APPROVED, CreditTxType.ADMIN_ADJUST] }, amount: { gt: 0 } },
        _sum: { amount: true },
      }),
    ]);
    return {
      users,
      usersToday,
      jobs,
      jobsToday,
      successRate: completed + failed ? completed / (completed + failed) : 1,
      pendingRequests: pending,
      creditsGranted: granted._sum.amount ?? 0,
      byFormat: byFormat.map((f) => ({ format: f.targetFormat, count: f._count._all })),
      daily: daily.map((d) => ({ day: d.day, total: Number(d.total), failed: Number(d.failed) })),
    };
  }

  async approveRequest(id: string, adminId: string, dto: ReviewRequestDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const req = await tx.creditRequest.findUnique({ where: { id } });
      if (!req) throw new AppError('NOT_FOUND', 'រកមិនឃើញសំណើ', HttpStatus.NOT_FOUND);
      if (req.status !== 'PENDING') throw new AppError('ALREADY_REVIEWED', 'សំណើនេះត្រូវបានពិនិត្យរួចហើយ', HttpStatus.CONFLICT);
      const amount = dto.amount ?? req.amount;
      await this.credits.adjust(req.userId, amount, CreditTxType.REQUEST_APPROVED, `${req.code}${dto.note ? ' – ' + dto.note : ''}`, adminId, tx);
      return tx.creditRequest.update({
        where: { id },
        data: { status: 'APPROVED', grantedAmount: amount, adminNote: dto.note, reviewedById: adminId, reviewedAt: new Date() },
      });
    });
    await this.credits.notify({ userId: result.userId });
    await this.broadcastPending();
    return result;
  }

  async rejectRequest(id: string, adminId: string, dto: ReviewRequestDto) {
    const res = await this.prisma.creditRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: { status: 'REJECTED', adminNote: dto.note, reviewedById: adminId, reviewedAt: new Date() },
    });
    if (!res.count) throw new AppError('ALREADY_REVIEWED', 'សំណើនេះត្រូវបានពិនិត្យរួចហើយ', HttpStatus.CONFLICT);
    await this.broadcastPending();
    return { ok: true };
  }

  /** Keeps the pending-requests badge correct in every open admin tab. */
  private async broadcastPending() {
    const pending = await this.prisma.creditRequest.count({ where: { status: 'PENDING' } });
    this.realtime.toAdmins(RealtimeEvent.AdminCreditRequest, { pending });
  }
}
