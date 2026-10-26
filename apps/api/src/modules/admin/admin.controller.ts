import { Body, Controller, Get, HttpStatus, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import { CreditTxType, Prisma, Role } from '@prisma/client';
import { CurrentIdentity, Roles } from '../../common/decorators/auth.decorators';
import { paging } from '../../common/dto/pagination.dto';
import { AppError } from '../../common/errors/app-error';
import { publicUser } from '../../common/serializers/user.serializer';
import { Identity } from '../../common/types/identity';
import { PrismaService } from '../../prisma/prisma.service';
import { publicJob } from '../conversions/conversion.serializer';
import { CreditsService } from '../credits/credits.service';
import { SettingsService } from '../settings/settings.service';
import { AdminService } from './admin.service';
import { AdjustCreditsDto, AdminListQuery, ReviewRequestDto, UpdateSettingsDto, UpdateUserDto } from './dto/admin.dto';

@Roles(Role.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
    private readonly credits: CreditsService,
    private readonly settings: SettingsService,
  ) {}

  @Get('stats')
  stats() {
    return this.admin.stats();
  }

  // ---- users ----

  @Get('users')
  async users(@Query() q: AdminListQuery) {
    const { page, take, skip } = paging(q);
    const where: Prisma.UserWhereInput = q.q
      ? { OR: [{ email: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }] }
      : {};
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take, include: { _count: { select: { jobs: true } } } }),
      this.prisma.user.count({ where }),
    ]);
    return { items: items.map((u) => ({ ...publicUser(u), jobCount: u._count.jobs })), total, page, pageSize: take };
  }

  @Get('users/:id')
  async user(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError('NOT_FOUND', 'រកមិនឃើញអ្នកប្រើប្រាស់', HttpStatus.NOT_FOUND);
    const [transactions, jobs, requests] = await Promise.all([
      this.prisma.creditTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.conversionJob.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 50 }),
      this.prisma.creditRequest.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);
    return { user: publicUser(user), transactions, jobs: jobs.map((j) => publicJob(j)), requests };
  }

  @Patch('users/:id')
  async updateUser(@CurrentIdentity() me: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto) {
    if (id === me.user!.id && (dto.role === 'USER' || dto.isActive === false)) {
      throw new AppError('SELF_LOCKOUT', 'មិនអាចដកសិទ្ធិ ឬផ្អាកគណនីខ្លួនឯងបានទេ');
    }
    return publicUser(await this.prisma.user.update({ where: { id }, data: dto }));
  }

  @Post('users/:id/credits')
  async adjust(@CurrentIdentity() me: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() dto: AdjustCreditsDto) {
    return publicUser(await this.credits.adjust(id, dto.amount, CreditTxType.ADMIN_ADJUST, dto.note, me.user!.id));
  }

  // ---- credit requests ----

  @Get('credit-requests')
  async requests(@Query() q: AdminListQuery) {
    const { page, take, skip } = paging(q);
    const where: Prisma.CreditRequestWhereInput = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.q
        ? {
            OR: [
              { code: { contains: q.q, mode: 'insensitive' } },
              { user: { email: { contains: q.q, mode: 'insensitive' } } },
              { user: { name: { contains: q.q, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.creditRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: {
          user: { select: { id: true, name: true, email: true, credits: true, telegram: true } },
          reviewer: { select: { name: true } },
        },
      }),
      this.prisma.creditRequest.count({ where }),
    ]);
    return { items, total, page, pageSize: take };
  }

  @Post('credit-requests/:id/approve')
  approve(@CurrentIdentity() me: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewRequestDto) {
    return this.admin.approveRequest(id, me.user!.id, dto);
  }

  @Post('credit-requests/:id/reject')
  reject(@CurrentIdentity() me: Identity, @Param('id', ParseUUIDPipe) id: string, @Body() dto: ReviewRequestDto) {
    return this.admin.rejectRequest(id, me.user!.id, dto);
  }

  // ---- conversions ----

  @Get('conversions')
  async conversions(@Query() q: AdminListQuery) {
    const { page, take, skip } = paging(q);
    const where: Prisma.ConversionJobWhereInput = {
      ...(q.status ? { status: q.status as never } : {}),
      ...(q.format ? { targetFormat: q.format } : {}),
      ...(q.userId ? { userId: q.userId } : {}),
      ...(q.q ? { originalName: { contains: q.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      this.prisma.conversionJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.conversionJob.count({ where }),
    ]);
    return { items: items.map((j) => ({ ...publicJob(j), user: j.user, guest: !j.userId })), total, page, pageSize: take };
  }

  // ---- settings ----

  @Get('settings')
  getSettings() {
    return this.settings.get();
  }

  @Put('settings')
  putSettings(@Body() dto: UpdateSettingsDto) {
    if (dto.telegramUsername !== undefined) dto.telegramUsername = dto.telegramUsername.replace(/^@/, '').trim();
    return this.settings.update(dto);
  }
}
