import { api, upload } from '@/services/http';
import type { ConvertOptions, Format, Job, Paged } from '@/types';

export interface ListParams {
  page?: number;
  pageSize?: number;
  status?: string;
  format?: string;
  q?: string;
}

export const conversionsApi = {
  list(params: ListParams = {}) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
    return api<Paged<Job>>(`/conversions?${qs}`);
  },

  get: (id: string) => api<Job>(`/conversions/${id}`),

  create(file: File, target: Format, opts: ConvertOptions, onProgress: (pct: number) => void, signal?: AbortSignal) {
    const form = new FormData();
    form.append('targetFormat', target);
    form.append('mode', opts.mode);
    form.append('ocr', opts.ocr);
    if (opts.password) form.append('password', opts.password);
    form.append('file', file); // file last: the fields are read before the upload is streamed
    return upload<Job>('/conversions', form, onProgress, signal);
  },

  /** Same uploaded PDF, another format: no re-upload. */
  reconvert: (id: string, target: Format, opts: ConvertOptions) =>
    api<Job>(`/conversions/${id}/reconvert`, { method: 'POST', json: { targetFormat: target, ...opts, password: opts.password || undefined } }),

  remove: (id: string) => api(`/conversions/${id}`, { method: 'DELETE' }),

  downloadUrl: (id: string) => `/api/conversions/${id}/download`,
  archiveUrl: (ids: string[]) => `/api/conversions/archive?ids=${ids.join(',')}`,
};
