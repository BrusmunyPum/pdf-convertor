import { ConversionJob } from '@prisma/client';

/** Job fields that are safe to send to the browser (never file paths or the IP hash). */
export function publicJob(j: ConversionJob, live?: { progress?: number; stage?: string }) {
  return {
    id: j.id,
    originalName: j.originalName,
    inputSize: j.inputSize,
    pageCount: j.pageCount,
    targetFormat: j.targetFormat,
    options: j.options,
    status: j.status,
    progress: Math.max(j.progress, live?.progress ?? 0),
    stage: live?.stage,
    outputName: j.outputName,
    outputSize: j.outputSize,
    error: j.error,
    warnings: j.warnings,
    quality: j.quality,
    creditsCharged: j.creditsCharged,
    durationMs: j.durationMs,
    downloadCount: j.downloadCount,
    available: j.status === 'COMPLETED' && !j.filesDeleted,
    canReconvert: !j.filesDeleted,
    expiresAt: j.expiresAt,
    createdAt: j.createdAt,
    finishedAt: j.finishedAt,
  };
}

export type PublicJob = ReturnType<typeof publicJob>;
