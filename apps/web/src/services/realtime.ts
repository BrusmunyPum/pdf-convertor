/**
 * Live updates from the API over WebSocket (Socket.IO).
 * The browser is identified by its cookies, exactly like normal API calls,
 * so it only ever receives its own jobs and credits (plus admin events for admins).
 * Event names must match apps/api/src/modules/realtime/realtime.events.ts.
 */
import { io, type Socket } from 'socket.io-client';
import { ref } from 'vue';
import type { Job } from '@/types';

export interface ServerEvents {
  'job:update': (job: Job) => void;
  'job:removed': (payload: { id: string }) => void;
  'credits:update': (payload: { credits: number }) => void;
  'admin:credit-request': (payload: { pending: number; code?: string; name?: string }) => void;
  'admin:job': (job: Job) => void;
}

let socket: Socket | null = null;

/** true while the socket is connected; pages fall back to polling when it is not */
export const connected = ref(false);

function ensure(): Socket {
  if (socket) return socket;
  socket = io({ path: '/api/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
  socket.on('connect', () => (connected.value = true));
  socket.on('disconnect', () => (connected.value = false));
  return socket;
}

export const realtime = {
  connect() {
    ensure();
  },

  /** Re-join with the new identity after sign in / sign out (cookies changed). */
  reconnect() {
    const s = ensure();
    s.disconnect();
    s.connect();
  },

  on<E extends keyof ServerEvents>(event: E, handler: ServerEvents[E]): () => void {
    const s = ensure();
    s.on(event, handler as never);
    return () => s.off(event, handler as never);
  },
};
