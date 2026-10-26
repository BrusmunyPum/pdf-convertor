import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { api } from '@/services/http';
import { realtime } from '@/services/realtime';
import type { PublicConfig, User } from '@/types';

export const useSession = defineStore('session', () => {
  const user = ref<User | null>(null);
  const credits = ref(0);
  const guestTotal = ref<number | null>(null);
  const config = ref<PublicConfig | null>(null);
  /** admins: number of credit requests waiting (kept live over WebSocket) */
  const pendingRequests = ref(0);
  const ready = ref(false);

  const isAdmin = computed(() => user.value?.role === 'ADMIN');
  const isGuest = computed(() => !user.value);

  async function refresh() {
    const s = await api<{ user: User | null; credits: number; guestTotal: number | null }>('/auth/session');
    user.value = s.user;
    credits.value = s.credits;
    guestTotal.value = s.guestTotal;
    if (s.user?.role === 'ADMIN') {
      const stats = await api<{ pendingRequests: number }>('/admin/stats').catch(() => null);
      pendingRequests.value = stats?.pendingRequests ?? 0;
    }
  }

  async function init() {
    if (ready.value) return;
    const [cfg] = await Promise.all([api<PublicConfig>('/config').catch(() => null), refresh().catch(() => null)]);
    config.value = cfg;
    ready.value = true;
    // the first API call set the guest cookie, so the socket can identify this browser now
    realtime.connect();
    realtime.on('credits:update', ({ credits: c }) => (credits.value = c));
    realtime.on('admin:credit-request', ({ pending }) => (pendingRequests.value = pending));
  }

  async function login(email: string, password: string) {
    const r = await api<{ user: User }>('/auth/login', { method: 'POST', json: { email, password } });
    user.value = r.user;
    await refresh();
    realtime.reconnect();
  }

  async function register(name: string, email: string, password: string) {
    const r = await api<{ user: User }>('/auth/register', { method: 'POST', json: { name, email, password } });
    user.value = r.user;
    await refresh();
    realtime.reconnect();
  }

  async function logout() {
    await api('/auth/logout', { method: 'POST' });
    user.value = null;
    pendingRequests.value = 0;
    await refresh();
    realtime.reconnect();
  }

  return {
    user, credits, guestTotal, config, pendingRequests, ready, isAdmin, isGuest,
    init, refresh, login, register, logout,
  };
});
