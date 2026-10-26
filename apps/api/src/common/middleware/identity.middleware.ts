import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import { NextFunction, Response } from 'express';
import { PrismaService } from '../../prisma/prisma.service';
import { AUTH_COOKIE, GUEST_COOKIE } from '../constants';
import { AppRequest } from '../types/identity';
import { cookieOptions } from '../utils/cookies';
import { hashIp } from '../utils/crypto';

/** Resolves who is calling: a signed-in user (JWT cookie) and/or an anonymous guest id. */
@Injectable()
export class IdentityMiddleware implements NestMiddleware {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async use(req: AppRequest, res: Response, next: NextFunction) {
    let user = null;
    const token = req.cookies?.[AUTH_COOKIE];
    if (token) {
      try {
        const payload = await this.jwt.verifyAsync<{ sub: string }>(token);
        user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
        if (user && !user.isActive) user = null;
      } catch {
        res.clearCookie(AUTH_COOKIE, { path: '/' });
      }
    }

    let guestId = req.signedCookies?.[GUEST_COOKIE];
    if (!guestId || typeof guestId !== 'string') {
      guestId = randomUUID();
      res.cookie(GUEST_COOKIE, guestId, { ...cookieOptions(365 * 24 * 3600 * 1000), signed: true });
    }

    req.identity = { user, guestId, ipHash: hashIp(req.ip ?? 'unknown') };
    next();
  }
}
