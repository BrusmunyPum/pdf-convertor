<script setup lang="ts">
import { mdiMagnify, mdiShieldCrownOutline } from '@mdi/js';
import { onMounted, ref, watch } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import Modal from '@/components/ui/Modal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { api, type ApiError } from '@/services/http';
import type { Job, Paged, User } from '@/types';
import { dateTime, khNum, timeAgo } from '@/utils/format';
import { FORMATS } from '@/constants/formats';
import { REQ_STATUS, STATUS, TX_TYPES } from '@/constants/labels';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';

type Row = User & { jobCount: number };
interface Detail {
  user: User;
  transactions: { id: string; amount: number; balanceAfter: number; type: string; note: string | null; createdAt: string }[];
  jobs: Job[];
  requests: { id: string; code: string; amount: number; status: string; createdAt: string }[];
}

const session = useSession();
const toast = useToast();
const q = ref('');
const page = ref(1);
const data = ref<Paged<Row> | null>(null);
const detail = ref<Detail | null>(null);
const tab = ref<'credits' | 'jobs' | 'requests'>('credits');
const adj = ref({ amount: 10, note: '' });
let t: ReturnType<typeof setTimeout> | undefined;

async function load() {
  const p = new URLSearchParams({ page: String(page.value), pageSize: '20' });
  if (q.value.trim()) p.set('q', q.value.trim());
  data.value = await api<Paged<Row>>(`/admin/users?${p}`);
}
watch(q, () => {
  clearTimeout(t);
  t = setTimeout(() => {
    page.value = 1;
    load();
  }, 350);
});
onMounted(load);

async function openUser(id: string) {
  detail.value = await api<Detail>(`/admin/users/${id}`);
  tab.value = 'credits';
  adj.value = { amount: 10, note: '' };
}

async function adjust(sign: 1 | -1) {
  if (!detail.value || !adj.value.amount) return;
  try {
    await api(`/admin/users/${detail.value.user.id}/credits`, {
      method: 'POST',
      json: { amount: sign * Math.abs(adj.value.amount), note: adj.value.note || undefined },
    });
    toast.success(sign > 0 ? 'បានបន្ថែមក្រេឌីត' : 'បានដកក្រេឌីត');
    await openUser(detail.value.user.id);
    load();
    session.refresh();
  } catch (e) {
    toast.error((e as ApiError).message);
  }
}

async function update(patch: Partial<Pick<User, 'role' | 'isActive'>>) {
  if (!detail.value) return;
  try {
    await api(`/admin/users/${detail.value.user.id}`, { method: 'PATCH', json: patch });
    toast.success('បានធ្វើបច្ចុប្បន្នភាព');
    await openUser(detail.value.user.id);
    load();
  } catch (e) {
    toast.error((e as ApiError).message);
  }
}
</script>

<template>
  <div>
    <div class="card">
      <div class="border-b border-slate-100 p-3">
        <div class="relative sm:w-80">
          <Icon :path="mdiMagnify" :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="q" class="input !py-2 !pl-9" placeholder="ស្វែងរកឈ្មោះ ឬអ៊ីមែល…" />
        </div>
      </div>
      <div class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr><th>ឈ្មោះ</th><th class="text-right">ក្រេឌីត</th><th class="text-right">ឯកសារ</th><th>ចុះឈ្មោះ</th><th>ស្ថានភាព</th></tr>
          </thead>
          <tbody>
            <tr v-for="u in data?.items" :key="u.id" class="cursor-pointer" @click="openUser(u.id)">
              <td>
                <p class="flex items-center gap-1.5 font-medium">
                  {{ u.name }}
                  <Icon v-if="u.role === 'ADMIN'" :path="mdiShieldCrownOutline" :size="15" class="text-amber-500" />
                </p>
                <p class="text-xs text-slate-500">{{ u.email }}</p>
              </td>
              <td class="text-right font-semibold tabular-nums">{{ khNum(u.credits) }}</td>
              <td class="text-right tabular-nums text-slate-600">{{ khNum(u.jobCount) }}</td>
              <td class="whitespace-nowrap text-slate-500">{{ timeAgo(u.createdAt) }}</td>
              <td>
                <span class="badge" :class="u.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'">
                  {{ u.isActive ? 'សកម្ម' : 'ផ្អាក' }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="data" class="px-4">
        <Pagination :page="data.page" :total="data.total" :page-size="data.pageSize" @change="(p) => { page = p; load(); }" />
      </div>
    </div>

    <Modal :open="!!detail" :title="detail?.user.name" wide @close="detail = null">
      <template v-if="detail">
        <div class="mb-5 flex flex-wrap items-center gap-3">
          <div class="flex-1">
            <p class="text-sm text-slate-500">{{ detail.user.email }}<template v-if="detail.user.telegram"> · @{{ detail.user.telegram }}</template></p>
            <p class="text-xs text-slate-400">ចុះឈ្មោះ {{ dateTime(detail.user.createdAt) }} · ចូលចុងក្រោយ {{ dateTime(detail.user.lastLoginAt) }}</p>
          </div>
          <div class="rounded-xl bg-amber-50 px-4 py-2 text-center">
            <p class="text-xs text-amber-700">ក្រេឌីត</p>
            <p class="text-xl font-semibold tabular-nums text-amber-900">{{ khNum(detail.user.credits) }}</p>
          </div>
        </div>

        <div class="mb-5 flex flex-wrap gap-2">
          <button class="btn-secondary btn-sm" @click="update({ isActive: !detail.user.isActive })">
            {{ detail.user.isActive ? 'ផ្អាកគណនី' : 'បើកគណនីវិញ' }}
          </button>
          <button class="btn-secondary btn-sm" @click="update({ role: detail.user.role === 'ADMIN' ? 'USER' : 'ADMIN' })">
            {{ detail.user.role === 'ADMIN' ? 'ដកសិទ្ធិអ្នកគ្រប់គ្រង' : 'តំឡើងជាអ្នកគ្រប់គ្រង' }}
          </button>
        </div>

        <div class="mb-4 flex gap-1 border-b border-slate-100">
          <button
            v-for="x in [{ v: 'credits', l: 'ក្រេឌីត' }, { v: 'jobs', l: 'ការបម្លែង' }, { v: 'requests', l: 'សំណើ' }] as const"
            :key="x.v"
            class="-mb-px border-b-2 px-3 py-2 text-sm transition"
            :class="tab === x.v ? 'border-brand-600 text-brand-700' : 'border-transparent text-slate-500 hover:text-slate-800'"
            @click="tab = x.v"
          >
            {{ x.l }}
          </button>
        </div>

        <div v-if="tab === 'credits'">
          <form class="mb-4 grid gap-2 sm:grid-cols-[120px_1fr_auto_auto]" @submit.prevent="adjust(1)">
            <input v-model.number="adj.amount" type="number" min="1" class="input" />
            <input v-model="adj.note" class="input" placeholder="កំណត់ចំណាំ" maxlength="300" />
            <button class="btn-primary">+ បន្ថែម</button>
            <button type="button" class="btn-secondary !text-red-600" @click="adjust(-1)">− ដក</button>
          </form>
          <ul class="divide-y divide-slate-100 text-sm">
            <li v-for="t in detail.transactions" :key="t.id" class="flex items-center justify-between py-2">
              <span>
                {{ TX_TYPES[t.type] ?? t.type }}
                <span v-if="t.note" class="text-xs text-slate-400"> · {{ t.note }}</span>
                <span class="block text-xs text-slate-400">{{ dateTime(t.createdAt) }}</span>
              </span>
              <span class="font-medium tabular-nums" :class="t.amount > 0 ? 'text-emerald-600' : 'text-slate-600'">{{ t.amount > 0 ? '+' : '' }}{{ khNum(t.amount) }}</span>
            </li>
          </ul>
        </div>
        <ul v-else-if="tab === 'jobs'" class="divide-y divide-slate-100 text-sm">
          <li v-if="!detail.jobs.length" class="py-6 text-center text-slate-500">មិនទាន់មាន</li>
          <li v-for="j in detail.jobs" :key="j.id" class="flex items-center gap-3 py-2">
            <Icon :path="FORMATS[j.targetFormat].icon" :size="18" :class="FORMATS[j.targetFormat].color" />
            <span class="min-w-0 flex-1 truncate">{{ j.originalName }}</span>
            <span class="text-xs text-slate-400">{{ timeAgo(j.createdAt) }}</span>
            <span class="badge" :class="STATUS[j.status].cls">{{ STATUS[j.status].label }}</span>
          </li>
        </ul>
        <ul v-else class="divide-y divide-slate-100 text-sm">
          <li v-if="!detail.requests.length" class="py-6 text-center text-slate-500">មិនទាន់មាន</li>
          <li v-for="r in detail.requests" :key="r.id" class="flex items-center justify-between py-2">
            <span>{{ r.code }} · {{ khNum(r.amount) }} <span class="block text-xs text-slate-400">{{ dateTime(r.createdAt) }}</span></span>
            <span class="badge" :class="REQ_STATUS[r.status].cls">{{ REQ_STATUS[r.status].label }}</span>
          </li>
        </ul>
      </template>
    </Modal>
  </div>
</template>
