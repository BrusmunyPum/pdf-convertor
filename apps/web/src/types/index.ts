export type Format = 'docx' | 'pptx' | 'xlsx' | 'csv' | 'txt' | 'png' | 'jpg';
export type JobStatus = 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'USER' | 'ADMIN';
  credits: number;
  telegram: string | null;
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

export interface JobQuality {
  scannedPages?: number[];
  garbledPages?: number[];
  khmerOrderFixed?: boolean;
  repairedFonts?: string[];
  unrepairedFonts?: string[];
  ocrSpans?: number;
  ocrUsed?: boolean;
}

export interface Job {
  id: string;
  originalName: string;
  inputSize: number;
  pageCount: number;
  targetFormat: Format;
  options: { mode?: 'flow' | 'exact'; ocr?: 'auto' | 'force' | 'off' };
  status: JobStatus;
  progress: number;
  stage?: string;
  outputName: string | null;
  outputSize: number | null;
  error: string | null;
  warnings: string[] | null;
  quality: JobQuality | null;
  creditsCharged: number;
  durationMs: number | null;
  downloadCount: number;
  available: boolean;
  canReconvert: boolean;
  expiresAt: string;
  createdAt: string;
  finishedAt: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface PublicConfig {
  guestCredits: number;
  signupCredits: number;
  creditCost: number;
  maxFileMb: number;
  maxPages: number;
  maxFilesPerBatch: number;
  telegramUsername: string;
  registrationOpen: boolean;
  announcement: string;
  formats: Format[];
}

export interface ConvertOptions {
  mode: 'flow' | 'exact';
  ocr: 'auto' | 'force' | 'off';
  password?: string;
}
