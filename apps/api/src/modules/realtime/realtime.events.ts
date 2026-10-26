/** Server -> browser WebSocket events (keep in sync with apps/web/src/services/realtime.ts). */
export const RealtimeEvent = {
  /** a conversion changed (queued, progress, completed, failed, deleted) */
  JobUpdate: 'job:update',
  JobRemoved: 'job:removed',
  /** the caller's credit balance changed */
  Credits: 'credits:update',
  /** admins only */
  AdminCreditRequest: 'admin:credit-request',
  AdminJob: 'admin:job',
} as const;

export const rooms = {
  user: (id: string) => `user:${id}`,
  guest: (id: string) => `guest:${id}`,
  admins: 'admins',
};
