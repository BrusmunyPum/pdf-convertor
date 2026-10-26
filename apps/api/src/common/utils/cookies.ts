import { signedCookie } from 'cookie-parser';
import { env } from '../../config/env';

export function cookieOptions(maxAgeMs: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.cookieSecure,
    maxAge: maxAgeMs,
    path: '/',
  };
}

/** Parse a raw Cookie header (used for WebSocket handshakes, which skip Express middleware). */
export function parseCookieHeader(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      out[key] = part.slice(i + 1).trim();
    }
  }
  return out;
}

/** Value of a cookie signed by cookie-parser ("s:<value>.<sig>"), or null if the signature is wrong. */
export function readSignedCookie(raw: string | undefined): string | null {
  if (!raw) return null;
  const value = signedCookie(raw, env.cookieSecret);
  return typeof value === 'string' && value !== raw ? value : null;
}
