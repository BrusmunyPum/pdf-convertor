import { HttpStatus, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { CreditTxType, Role, User } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { Response } from 'express';
import { AUTH_COOKIE } from '../../common/constants';
import { AppError } from '../../common/errors/app-error';
import { Identity } from '../../common/types/identity';
import { cookieOptions } from '../../common/utils/cookies';
import { env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { CreditsService } from '../credits/credits.service';
import { SettingsService } from '../settings/settings.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

const SESSION_MS = 7 * 24 * 3600 * 1000;

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly log = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly settings: SettingsService,
    private readonly credits: CreditsService,
  ) {}

  /** Create the first admin from env on startup. */
  async onModuleInit() {
    const { email, password, name } = env.admin;
    if (!email || !password) return;
    if (await this.prisma.user.findUnique({ where: { email } })) return;
    await this.prisma.user.create({
      data: { email, name, passwordHash: await bcrypt.hash(password, 12), role: Role.ADMIN, credits: 1000 },
    });
    this.log.log(`created admin ${email}`);
  }

  async register(dto: RegisterDto, identity: Identity) {
    const s = await this.settings.get();
    if (!s.registrationOpen) throw new AppError('REGISTRATION_CLOSED', 'ការចុះឈ្មោះត្រូវបានបិទជាបណ្ដោះអាសន្ន', HttpStatus.FORBIDDEN);
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new AppError('EMAIL_TAKEN', 'អ៊ីមែលនេះត្រូវបានប្រើរួចហើយ', HttpStatus.CONFLICT);
    }
    const user = await this.prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: { email: dto.email, name: dto.name.trim(), passwordHash: await bcrypt.hash(dto.password, 12) },
      });
      return s.signupCredits > 0
        ? this.credits.adjust(u.id, s.signupCredits, CreditTxType.SIGNUP_BONUS, 'Welcome bonus', undefined, tx)
        : u;
    });
    await this.claimGuestHistory(user, identity);
    return user;
  }

  async login(dto: LoginDto, identity: Identity) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    const ok = user && (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) throw new AppError('BAD_CREDENTIALS', 'អ៊ីមែល ឬពាក្យសម្ងាត់មិនត្រឹមត្រូវ', HttpStatus.UNAUTHORIZED);
    if (!user.isActive) throw new AppError('ACCOUNT_DISABLED', 'គណនីនេះត្រូវបានផ្អាក។ សូមទាក់ទងអ្នកគ្រប់គ្រង។', HttpStatus.FORBIDDEN);
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    await this.claimGuestHistory(updated, identity);
    return updated;
  }

  /** Conversions made before signing in move into the account history. */
  private async claimGuestHistory(user: User, identity: Identity) {
    await this.prisma.conversionJob.updateMany({
      where: { guestId: identity.guestId, userId: null },
      data: { userId: user.id },
    });
  }

  issueSession(res: Response, user: User) {
    const token = this.jwt.sign({ sub: user.id, role: user.role });
    res.cookie(AUTH_COOKIE, token, cookieOptions(SESSION_MS));
  }
}
