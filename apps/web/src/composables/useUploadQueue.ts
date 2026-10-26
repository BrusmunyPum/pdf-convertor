/**
 * Multi-file conversion queue for the home page.
 *
 * Each picked PDF is one item. Uploads run 2 at a time; after upload the server
 * job (kept live in the jobs store over WebSocket) drives the item's status.
 * Choosing another format later converts the already-uploaded copy again
 * (no re-upload), so there is a single "convert" action for everything.
 */
import { computed, reactive, ref } from 'vue';
import { conversionsApi } from '@/api/conversions';
import { ApiError } from '@/services/http';
import { useJobs } from '@/stores/jobs';
import { useSession } from '@/stores/session';
import type { ConvertOptions, Format, Job } from '@/types';
import { khNum } from '@/utils/format';

export type ItemStatus = 'ready' | 'uploading' | 'queued' | 'processing' | 'done' | 'failed';

export interface QueueItem {
  key: string;
  file: File | null;
  name: string;
  size: number;
  uploadPct: number;
  jobId: string | null;
  /** state before the server has a job for it */
  local: 'ready' | 'uploading' | 'failed';
  error: string;
  errorCode: string;
  abort?: AbortController;
}

const UPLOAD_CONCURRENCY = 2;

export function useUploadQueue() {
  const session = useSession();
  const jobs = useJobs();
  jobs.start();

  const items = reactive<QueueItem[]>([]);
  const running = ref(false);

  const jobOf = (item: QueueItem): Job | undefined => (item.jobId ? jobs.get(item.jobId) : undefined);

  function statusOf(item: QueueItem): ItemStatus {
    const job = jobOf(item);
    if (!job) return item.local;
    if (job.status === 'QUEUED') return 'queued';
    if (job.status === 'PROCESSING') return 'processing';
    if (job.status === 'COMPLETED') return 'done';
    return 'failed';
  }

  /** Would pressing "convert" now do something for this item, for this format? */
  function needsWork(item: QueueItem, target: Format): boolean {
    const st = statusOf(item);
    if (st === 'uploading' || st === 'queued' || st === 'processing') return false;
    const job = jobOf(item);
    if (!job) return true; // not uploaded yet, or upload failed
    if (st === 'failed') return job.canReconvert;
    return job.targetFormat !== target && job.canReconvert;
  }

  function addFiles(list: FileList | File[]): string[] {
    const problems: string[] = [];
    const maxMb = session.config?.maxFileMb ?? 50;
    const maxFiles = session.config?.maxFilesPerBatch ?? 10;
    for (const f of Array.from(list)) {
      if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
        problems.push(`${f.name}: មិនមែន PDF`);
        continue;
      }
      if (f.size > maxMb * 1024 * 1024) {
        problems.push(`${f.name}: ធំជាង ${khNum(maxMb)}MB`);
        continue;
      }
      if (items.some((i) => i.file && i.name === f.name && i.size === f.size && i.file.lastModified === f.lastModified)) continue;
      if (items.length >= maxFiles) {
        problems.push(`អាចបម្លែងបានអតិបរមា ${khNum(maxFiles)} ឯកសារក្នុងមួយលើក`);
        break;
      }
      items.push({ key: crypto.randomUUID(), file: f, name: f.name, size: f.size, uploadPct: 0, jobId: null, local: 'ready', error: '', errorCode: '' });
    }
    return problems;
  }

  function remove(item: QueueItem) {
    item.abort?.abort();
    const i = items.indexOf(item);
    if (i >= 0) items.splice(i, 1);
  }

  function clearFinished() {
    for (const item of [...items]) {
      const st = statusOf(item);
      if (st === 'done' || st === 'failed' || st === 'ready') remove(item);
    }
  }

  async function processOne(item: QueueItem, target: Format, opts: ConvertOptions) {
    item.error = '';
    item.errorCode = '';
    try {
      let job: Job;
      const prev = jobOf(item);
      if (prev?.canReconvert) {
        job = await conversionsApi.reconvert(prev.id, target, opts);
      } else if (item.file) {
        item.local = 'uploading';
        item.uploadPct = 0;
        item.abort = new AbortController();
        job = await conversionsApi.create(item.file, target, opts, (p) => (item.uploadPct = p), item.abort.signal);
      } else {
        throw new ApiError('EXPIRED', 'ឯកសារដើមមិនមានទៀតទេ។ សូមផ្ទុកឡើងម្ដងទៀត។', 410);
      }
      jobs.upsert(job);
      item.jobId = job.id;
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'ABORTED') return;
      item.local = 'failed';
      item.jobId = null;
      item.error = err.message;
      item.errorCode = err.code;
    } finally {
      item.abort = undefined;
    }
  }

  /** Convert every item that needs it into `target`. Returns how many were started. */
  async function start(target: Format, opts: ConvertOptions): Promise<{ started: number; skipped: number }> {
    const todo = items.filter((i) => needsWork(i, target));
    const cost = session.config?.creditCost ?? 1;
    const affordable = Math.floor(session.credits / cost);
    const batch = todo.slice(0, affordable);
    running.value = true;
    try {
      let next = 0;
      const worker = async () => {
        while (next < batch.length) await processOne(batch[next++], target, opts);
      };
      await Promise.all(Array.from({ length: Math.min(UPLOAD_CONCURRENCY, batch.length) }, worker));
    } finally {
      running.value = false;
    }
    return { started: batch.length, skipped: todo.length - batch.length };
  }

  const counts = computed(() => {
    const c = { ready: 0, uploading: 0, queued: 0, processing: 0, done: 0, failed: 0 };
    for (const i of items) c[statusOf(i)]++;
    return c;
  });
  const busy = computed(() => running.value || counts.value.uploading + counts.value.queued + counts.value.processing > 0);
  const doneJobIds = computed(() => items.map(jobOf).filter((j): j is Job => !!j && j.available).map((j) => j.id));

  return { items, running, busy, counts, doneJobIds, jobOf, statusOf, needsWork, addFiles, remove, clearFinished, start };
}
