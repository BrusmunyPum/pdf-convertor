import { promises as fs } from 'fs';
import * as path from 'path';
import { env } from '../../config/env';

/** Layout of the shared data volume: /data/tmp/<upload>.pdf and /data/jobs/<id>/{input.pdf,out/…}. */
export const TMP_DIR = path.join(env.dataDir, 'tmp');

export const jobDir = (id: string) => path.join(env.dataDir, 'jobs', id);
export const jobInput = (id: string) => path.join(jobDir(id), 'input.pdf');
export const jobOutputDir = (id: string) => path.join(jobDir(id), 'out');

export interface ConverterProgress {
  progress: number;
  message?: string;
}

/** The converter writes its progress to a small JSON file next to the output. */
export async function readProgress(id: string): Promise<ConverterProgress | null> {
  try {
    const raw = await fs.readFile(path.join(jobOutputDir(id), 'progress.json'), 'utf8');
    const p = JSON.parse(raw) as Partial<ConverterProgress>;
    return typeof p.progress === 'number' ? { progress: p.progress, message: p.message } : null;
  } catch {
    return null;
  }
}

export const removeJobFiles = (id: string) => fs.rm(jobDir(id), { recursive: true, force: true });
