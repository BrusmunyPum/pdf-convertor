import { Body, Controller, Get, HttpStatus, Post, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Authenticated, CurrentIdentity } from '../../common/decorators/auth.decorators';
import { PaginationQuery, paging } from '../../common/dto/pagination.dto';
import { AppError } from '../../common/errors/app-error';
import { Identity } from '../../common/types/identity';
import { shortCode } from '../../common/utils/crypto';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { RealtimeEvent } from '../realtime/realtime.events';
import { RealtimeService } from '../realtime/realtime.service';
import { SettingsService } from '../settings/settings.service';
import { TelegramService } from '../telegram/telegram.service';
import { CreditsService } from './credits.service';
import { CreateCreditRequestDto } from './dto/create-credit-request.dto';

@Controller('credits')
export class CreditsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly credits: CreditsService,
    private readonly settings: SettingsService,
    private readonly telegram: TelegramService,
    private readonly realtime: RealtimeService,
  ) {}

  @Get('balance')
  balance(@CurrentIdentity() id: Identity) {
    return this.credits.balanceFor(id);
  }

  @Authenticated()
  @Get('transactions')
  async transactions(@CurrentIdentity() id: Identity, @Query() q: PaginationQuery) {
    const { page, take, skip } = paging(q);
    const where = { userId: id.user!.id };
    const [items, total] = await Promise.all([
      this.prisma.creditTransaction.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take }),
      this.prisma.creditTransaction.count({ where }),
    ]);
    return { items, total, page, pageSize: take };
  }

  @Authenticated()
  @Get('requests')
  requests(@CurrentIdentity() id: Identity) {
    return this.prisma.creditRequest.findMany({ where: { userId: id.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  @Authenticated()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('requests')
  async createRequest(@CurrentIdentity() id: Identity, @Body() dto: CreateCreditRequestDto) {
    const user = id.user!;
    const pending = await this.prisma.creditRequest.count({ where: { userId: user.id, status: 'PENDING' } });
    if (pending >= 3) {
      throw new AppError('TOO_MANY_PENDING', 'អ្នកមានសំណើកំពុងរង់ចាំច្រើនពេកហើយ។ សូមរង់ចាំអ្នកគ្រប់គ្រងពិនិត្យ។', HttpStatus.CONFLICT);
    }
    const req = await this.prisma.creditRequest.create({
      data: { userId: user.id, amount: dto.amount, message: dto.message, code: shortCode('CR') },
    });

    const pendingTotal = await this.prisma.creditRequest.count({ where: { status: 'PENDING' } });
    this.realtime.toAdmins(RealtimeEvent.AdminCreditRequest, { pending: pendingTotal, code: req.code, name: user.name });
    void this.telegram.notifyAdmin(
      `🧾 សំណើក្រេឌីតថ្មី ${req.code}\n👤 ${user.name} (${user.email})\n➕ ${dto.amount} ក្រេឌីត\n💬 ${dto.message ?? '-'}\n` +
        `${env.publicUrl}/admin/requests`,
    );

    const s = await this.settings.get();
    const text = encodeURIComponent(`សួស្តី! ខ្ញុំសូមស្នើសុំក្រេឌីត ${dto.amount}។\nលេខកូដសំណើ: ${req.code}\nអ៊ីមែល: ${user.email}`);
    return { ...req, telegramUrl: s.telegramUsername ? `https://t.me/${s.telegramUsername}?text=${text}` : null };
  }
}
