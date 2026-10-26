import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { conversionsApi } from '@/api/conversions';
import { connected, realtime } from '@/services/realtime';
import type { Job } from '@/types';

const ACTIVE = new Set<Job['status']>(['QUEUED', 'PROCESSING']);

/**
 * Latest known state of every conversion this tab cares about.
 * Fed by WebSocket events; if the socket is down, active jobs are polled instead.
 */
export const useJobs = defineStore('jobs', () => {
  const byId = reactive(new Map<string, Job>());
  const removed = reactive(new Set<string>());
  let started = false;
  let pollTimer: ReturnType<typeof setInterval> | undefined;

  function upsert(job: Job) {
    const prev = byId.get(job.id);
    // progress only moves forward (events can arrive out of order)
    if (prev && prev.status === job.status && (job.progress ?? 0) < (prev.progress ?? 0)) {
      job = { ...job, progress: prev.progress, stage: job.stage ?? prev.stage };
    }
    byId.set(job.id, job);
  }

  function start() {
    if (started) return;
    started = true;
    realtime.on('job:update', upsert);
    realtime.on('job:removed', ({ id }) => {
      byId.delete(id);
      removed.add(id);
    });
    // safety net when WebSocket is blocked (some proxies / networks)
    pollTimer = setInterval(async () => {
      if (connected.value) return;
      const active = [...byId.values()].filter((j) => ACTIVE.has(j.status));
      for (const j of active) {
        try {
          upsert(await conversionsApi.get(j.id));
        } catch {
          /* try again next tick */
        }
      }
    }, 2000);
  }

  function stop() {
    clearInterval(pollTimer);
  }

  return { byId, removed, upsert, start, stop, get: (id: string) => byId.get(id) };
});
