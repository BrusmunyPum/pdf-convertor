import { env } from '../../config/env';

/** Admin-editable settings (stored in the Setting table; env values are the first defaults). */
export interface AppSettings {
  guestCredits: number;
  signupCredits: number;
  guestIpDailyCap: number;
  creditCost: number;
  maxFileMb: number;
  maxPages: number;
  maxFilesPerBatch: number;
  guestFileTtlHours: number;
  userFileTtlHours: number;
  telegramUsername: string;
  registrationOpen: boolean;
  announcement: string;
}

export function defaultSettings(): AppSettings {
  return {
    ...env.defaults,
    creditCost: 1,
    maxFilesPerBatch: 10,
    telegramUsername: env.telegram.adminUsername,
    registrationOpen: true,
    announcement: '',
  };
}
