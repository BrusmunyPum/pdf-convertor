import { HttpStatus, Injectable } from '@nestjs/common';
import { CreditTxType, Prisma } from '@prisma/client';
import { AppError } from '../../common/errors/app-error';
import { Identity } from '../../common/types/identity';
import { PrismaService } from '../../prisma/prisma.service';
import { Owner, RealtimeService } from '../realtime/realtime.service';
import { SettingsService } from '../settings/settings.service';

type Tx = Prisma.TransactionClient;

@Injectable()
export class CreditsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly realtime: RealtimeService,
  ) {}

  /** Credits a guest still has, limited per browser and per IP per day. */
  async guestBalance(guestId: string, ipHash: string) {
    const s = await this.settings.get();
    const guest = await this.prisma.guest.findUnique({ where: { id: guestId } });
    const used = guest?.creditsUsed ?? 0;
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const ipAgg = await this.prisma.conversionJob.aggregate({
      where: { ipHash, userId: null, createdAt: { gte: since }, status: { not: 'FAILED' } },
      _sum: { creditsCharged: true },
    });
    const ipUsed = ipAgg._sum.creditsCharged ?? 0;
    const left = Math.max(0, Math.min(s.guestCredits - used, s.guestIpDailyCap - ipUsed));
    return { total: s.guestCredits, used, left };
  }

  async balanceFor(identity: Identity) {
    if (identity.user) {
      // read fresh: the identity was loaded at the start of the request
      const u = await this.prisma.user.findUnique({ where: { id: identity.user.id }, select: { credits: true } });
      return { credits: u?.credits ?? 0, guest: false };
    }
    const g = await this.guestBalance(identity.guestId, identity.ipHash);
    return { credits: g.left, guest: true, guestTotal: g.total };
  }

  async assertCanAfford(identity: Identity, cost: number) {
    const bal = await this.balanceFor(identity);
    if (bal.credits < cost) throw this.noCredits(bal.guest);
  }

  /** Charge credits inside a transaction. Throws when there is not enough. */
  async charge(tx: Tx, identity: Identity, cost: number, jobId: string) {
    if (identity.user) {
      const res = await tx.user.updateMany({
        where: { id: identity.user.id, credits: { gte: cost } },
        data: { credits: { decrement: cost } },
      });
      if (res.count !== 1) throw this.noCredits(false);
      const u = await tx.user.findUniqueOrThrow({ where: { id: identity.user.id } });
      await tx.creditTransaction.create({
        data: { userId: u.id, amount: -cost, balanceAfter: u.credits, type: CreditTxType.CONVERSION, jobId, note: 'Conversion' },
      });
      return;
    }
    const bal = await this.guestBalance(identity.guestId, identity.ipHash);
    if (bal.left < cost) throw this.noCredits(true);
    await tx.guest.upsert({
      where: { id: identity.guestId },
      create: { id: identity.guestId, ipHash: identity.ipHash, creditsUsed: cost },
      update: { creditsUsed: { increment: cost }, lastSeenAt: new Date(), ipHash: identity.ipHash },
    });
  }

  /** Give credits back when a conversion fails. */
  async refund(job: { id: string; userId: string | null; guestId: string | null; creditsCharged: number }) {
    if (!job.creditsCharged) return;
    await this.prisma.$transaction(async (tx) => {
      if (job.userId) {
        const u = await tx.user.update({ where: { id: job.userId }, data: { credits: { increment: job.creditsCharged } } });
        await tx.creditTransaction.create({
          data: {
            userId: u.id,
            amount: job.creditsCharged,
            balanceAfter: u.credits,
            type: CreditTxType.REFUND,
            jobId: job.id,
            note: 'Conversion failed – refunded',
          },
        });
      } else if (job.guestId) {
        await tx.guest.updateMany({
          where: { id: job.guestId, creditsUsed: { gte: job.creditsCharged } },
          data: { creditsUsed: { decrement: job.creditsCharged } },
        });
      }
      await tx.conversionJob.update({ where: { id: job.id }, data: { creditsCharged: 0 } });
    });
    await this.notify({ userId: job.userId, guestId: job.guestId });
  }

  /** Add (or remove with a negative amount) credits by an admin or an approved request. */
  async adjust(userId: string, amount: number, type: CreditTxType, note: string | undefined, actorId?: string, tx?: Tx) {
    const run = async (t: Tx) => {
      const current = await t.user.findUniqueOrThrow({ where: { id: userId } });
      if (current.credits + amount < 0) throw new AppError('INVALID_AMOUNT', 'ក្រេឌីតមិនអាចតិចជាង 0 បានទេ');
      const u = await t.user.update({ where: { id: userId }, data: { credits: { increment: amount } } });
      await t.creditTransaction.create({ data: { userId, amount, balanceAfter: u.credits, type, note, actorId } });
      return u;
    };
    if (tx) return run(tx); // caller notifies after its transaction commits
    const user = await this.prisma.$transaction(run);
    this.realtime.creditsChanged({ userId }, user.credits);
    return user;
  }

  /** Push the current balance of a user or guest to their open browser tabs. */
  async notify(owner: Owner) {
    if (owner.userId) {
      const u = await this.prisma.user.findUnique({ where: { id: owner.userId }, select: { credits: true } });
      if (u) this.realtime.creditsChanged(owner, u.credits);
    } else if (owner.guestId) {
      const g = await this.prisma.guest.findUnique({ where: { id: owner.guestId } });
      if (g) this.realtime.creditsChanged(owner, (await this.guestBalance(g.id, g.ipHash)).left);
    }
  }

  private noCredits(guest: boolean) {
    return guest
      ? new AppError('NO_GUEST_CREDITS', 'អ្នកបានប្រើក្រេឌីតឥតគិតថ្លៃអស់ហើយ។ សូមចុះឈ្មោះដើម្បីទទួលបានក្រេឌីតបន្ថែម។', HttpStatus.PAYMENT_REQUIRED)
      : new AppError('NO_CREDITS', 'ក្រេឌីតរបស់អ្នកអស់ហើយ។ សូមស្នើសុំក្រេឌីតបន្ថែមតាម Telegram។', HttpStatus.PAYMENT_REQUIRED);
  }
}
