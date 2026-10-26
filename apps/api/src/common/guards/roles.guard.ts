import { CanActivate, ExecutionContext, HttpStatus, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { AUTH_KEY, ROLES_KEY } from '../decorators/auth.decorators';
import { AppError } from '../errors/app-error';
import { AppRequest } from '../types/identity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const targets = [ctx.getHandler(), ctx.getClass()];
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, targets);
    const needsAuth = this.reflector.getAllAndOverride<boolean>(AUTH_KEY, targets);
    if (!roles?.length && !needsAuth) return true;

    const user = ctx.switchToHttp().getRequest<AppRequest>().identity?.user;
    if (!user) throw new AppError('UNAUTHORIZED', 'សូមចូលគណនីជាមុនសិន', HttpStatus.UNAUTHORIZED);
    if (roles?.length && !roles.includes(user.role)) {
      throw new AppError('FORBIDDEN', 'អ្នកមិនមានសិទ្ធិចូលប្រើទំព័រនេះទេ', HttpStatus.FORBIDDEN);
    }
    return true;
  }
}
