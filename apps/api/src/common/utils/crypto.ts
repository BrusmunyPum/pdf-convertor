import { createHash, randomBytes } from 'crypto';
import { env } from '../../config/env';

/** IPs are never stored in clear text: only a salted hash, used to cap guest usage. */
export function hashIp(ip: string): string {
  return createHash('sha256').update(`${ip}:${env.cookieSecret}`).digest('hex').slice(0, 32);
}

/** Short human-friendly code, e.g. "CR-7K2QM9" (no 0/O/1/I). */
export function shortCode(prefix: string, length = 6): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `${prefix}-` + Array.from(randomBytes(length), (b) => alphabet[b % alphabet.length]).join('');
}
