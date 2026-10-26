import * as path from 'path';

// local development: read apps/api/.env if present (in Docker the variables come from compose)
try {
  process.loadEnvFile(path.resolve('.env'));
} catch {
  /* no .env file */
}

const num = (value: string | undefined, fallback: number) =>
  value !== undefined && value !== '' && !Number.isNaN(Number(value)) ? Number(value) : fallback;

/** Every environment setting the API reads, in one place. */
export const env = {
  port: num(process.env.PORT, 3000),
  publicUrl: process.env.PUBLIC_URL ?? '',

  jwtSecret: process.env.JWT_SECRET ?? '',
  cookieSecret: process.env.COOKIE_SECRET ?? '',
  cookieSecure: process.env.COOKIE_SECURE === 'true',

  redisHost: process.env.REDIS_HOST ?? 'localhost',
  redisPort: num(process.env.REDIS_PORT, 6379),
  queueConcurrency: num(process.env.QUEUE_CONCURRENCY, 2),

  converterUrl: process.env.CONVERTER_URL ?? 'http://localhost:8000',
  dataDir: process.env.DATA_DIR ?? path.resolve('data'),

  admin: {
    email: process.env.ADMIN_EMAIL?.toLowerCase(),
    password: process.env.ADMIN_PASSWORD,
    name: process.env.ADMIN_NAME ?? 'Admin',
  },

  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    adminChatId: process.env.TELEGRAM_ADMIN_CHAT_ID,
    adminUsername: process.env.TELEGRAM_ADMIN_USERNAME ?? '',
  },

  defaults: {
    guestCredits: num(process.env.GUEST_FREE_CREDITS, 3),
    signupCredits: num(process.env.SIGNUP_FREE_CREDITS, 20),
    guestIpDailyCap: num(process.env.GUEST_IP_DAILY_CAP, 10),
    maxFileMb: num(process.env.MAX_FILE_MB, 50),
    maxPages: num(process.env.MAX_PAGES, 300),
    guestFileTtlHours: num(process.env.GUEST_FILE_TTL_HOURS, 24),
    userFileTtlHours: num(process.env.USER_FILE_TTL_HOURS, 168),
  },
};
