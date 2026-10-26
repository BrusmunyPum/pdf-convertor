import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { AUTH_COOKIE } from '../../common/constants';
import { CurrentIdentity } from '../../common/decorators/auth.decorators';
import { publicUser } from '../../common/serializers/user.serializer';
import { Identity } from '../../common/types/identity';
import { CreditsService } from '../credits/credits.service';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly credits: CreditsService,
  ) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @CurrentIdentity() id: Identity, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.register(dto, id);
    this.auth.issueSession(res, user);
    return { user: publicUser(user) };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(200)
  @Post('login')
  async login(@Body() dto: LoginDto, @CurrentIdentity() id: Identity, @Res({ passthrough: true }) res: Response) {
    const user = await this.auth.login(dto, id);
    this.auth.issueSession(res, user);
    return { user: publicUser(user) };
  }

  @HttpCode(200)
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(AUTH_COOKIE, { path: '/' });
    return { ok: true };
  }

  /** Who am I + how many credits do I have (works for guests too). */
  @Get('session')
  async session(@CurrentIdentity() id: Identity) {
    const bal = await this.credits.balanceFor(id);
    return { user: id.user ? publicUser(id.user) : null, credits: bal.credits, guestTotal: bal.guestTotal ?? null };
  }
}
