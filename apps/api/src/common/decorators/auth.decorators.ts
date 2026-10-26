import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
import { AppRequest, Identity } from '../types/identity';

export const ROLES_KEY = 'roles';
export const AUTH_KEY = 'auth_required';

/** Only signed-in users with one of these roles. */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

/** Any signed-in user. */
export const Authenticated = () => SetMetadata(AUTH_KEY, true);

export const CurrentIdentity = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): Identity => ctx.switchToHttp().getRequest<AppRequest>().identity,
);
