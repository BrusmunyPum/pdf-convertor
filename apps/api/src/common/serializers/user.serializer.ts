import { User } from '@prisma/client';

/** User fields that are safe to send to the browser (never the password hash). */
export function publicUser(u: User) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    credits: u.credits,
    telegram: u.telegram,
    isActive: u.isActive,
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt,
  };
}
