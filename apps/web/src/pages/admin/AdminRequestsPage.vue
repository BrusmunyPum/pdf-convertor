<script setup lang="ts">
import { mdiCheck, mdiClose, mdiSend, mdiStarFourPointsOutline } from '@mdi/js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import Modal from '@/components/ui/Modal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { api, type ApiError } from '@/services/http';
import type { Paged } from '@/types';
import { dateTime, khNum, timeAgo } from '@/utils/format';
import { REQ_STATUS } from '@/constants/labels';
import { realtime } from '@/services/realtime';
import { useToast } from '@/stores/toast';

interface Req {
  id: string;
  code: string;
  amount: number;
  grantedAmount: number | null;
  message: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  reviewedAt: string | null;
  user: { id: string; name: string; email: string; credits: number; telegram: string | null };
  reviewer: { name: string } | null;
}

const toast = useToast();
const status = ref('PENDING');
const q = ref('');
const page = ref(1);
const data = ref<Paged<Req> | null>(null);
const active = ref<Req | null>(null);
const action = ref<'approve' | 'reject'>('approve');
const amount = ref(0);
const note = ref('');
const saving = ref(false);

async function load() {
  const p = new URLSearchParams({ page: String(page.value), pageSize: '20' });
  if (status.value) p.set('status', status.value);
  if (q.value) p.set('q', q.value);
  data.value = await api<Paged<Req>>(`/admin/credit-requests?${p}`);
}
watch([status, q], () => {
  page.value = 1;
  load();
});
onMounted(load);
// a request was created / reviewed somewhere: refresh the list
const off = realtime.on('admin:credit-request', () => load());
onBeforeUnmount(off);

function open(r: Req, a: 'approve' | 'reject') {
  active.value = r;
  action.value = a;
  amount.value = r.amount;
  note.value = '';
}

async function submit() {
  if (!active.value) return;
  saving.value = true;
  try {
    const body = action.value === 'approve' ? { amount: amount.value, note: note.value || undefined } : { note: note.value || undefined };
    await api(`/admin/credit-requests/${active.value.id}/${action.value}`, { method: 'POST', json: body });
    toast.success(action.value === 'approve' ? `បានផ្ដល់ ${khNum(amount.value)} ក្រេឌីត` : 'បានបដិសេធសំណើ');
    active.value = null;
    load();
  } catch (e) {
    toast.error((e as ApiError).message);
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div>
    <div class="card">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center">
        <div class="flex gap-1">
          <button
            v-for="t in [{ v: 'PENDING', l: 'រង់ចាំ' }, { v: 'APPROVED', l: 'បានអនុម័ត' }, { v: 'REJECTED', l: 'បានបដិសេធ' }, { v: '', l: 'ទាំងអស់' }]"
            :key="t.v"
            class="rounded-lg px-3 py-1.5 text-sm transition"
            :class="status === t.v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
            @click="status = t.v"
          >
            {{ t.l }}
          </button>
        </div>
        <input v-model.lazy="q" class="input !py-2 sm:ml-auto sm:w-64" placeholder="លេខកូដ ឬអ៊ីមែល…" />
      </div>

      <EmptyState v-if="data && !data.items.length" :icon="mdiStarFourPointsOutline" title="គ្មានសំណើ" />
      <div v-else class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr><th>លេខកូដ</th><th>អ្នកប្រើ</th><th class="text-right">ចំនួន</th><th>សារ</th><th>ស្ថានភាព</th><th></th></tr>
          </thead>
          <TransitionGroup name="list" tag="tbody">
            <tr v-for="r in data?.items" :key="r.id">
              <td>
                <p class="font-mono text-xs font-medium">{{ r.code }}</p>
                <p class="text-xs text-slate-500">{{ timeAgo(r.createdAt) }}</p>
              </td>
              <td>
                <p class="font-medium">{{ r.user.name }}</p>
                <p class="text-xs text-slate-500">{{ r.user.email }} · មាន {{ khNum(r.user.credits) }}</p>
              </td>
              <td class="text-right font-semibold tabular-nums">{{ khNum(r.grantedAmount ?? r.amount) }}</td>
              <td class="max-w-[220px] truncate text-slate-600" :title="r.message ?? ''">{{ r.message || '—' }}</td>
              <td>
                <span class="badge" :class="REQ_STATUS[r.status].cls">{{ REQ_STATUS[r.status].label }}</span>
                <p v-if="r.reviewer" class="mt-0.5 text-xs text-slate-400">{{ r.reviewer.name }} · {{ dateTime(r.reviewedAt) }}</p>
              </td>
              <td class="whitespace-nowrap text-right">
                <a v-if="r.user.telegram" :href="`https://t.me/${r.user.telegram}`" target="_blank" rel="noopener" class="btn-ghost btn-sm !px-2 text-[#229ED9]" title="Telegram">
                  <Icon :path="mdiSend" :size="16" />
                </a>
                <template v-if="r.status === 'PENDING'">
                  <button class="btn-secondary btn-sm !text-red-600" @click="open(r, 'reject')"><Icon :path="mdiClose" :size="14" /> បដិសេធ</button>
                  <button class="btn-primary btn-sm ml-1" @click="open(r, 'approve')"><Icon :path="mdiCheck" :size="14" /> អនុម័ត</button>
                </template>
              </td>
            </tr>
          </TransitionGroup>
        </table>
      </div>
      <div v-if="data" class="px-4">
        <Pagination :page="data.page" :total="data.total" :page-size="data.pageSize" @change="(p) => { page = p; load(); }" />
      </div>
    </div>

    <Modal :open="!!active" :title="action === 'approve' ? `អនុម័ត ${active?.code}` : `បដិសេធ ${active?.code}`" @close="active = null">
      <form class="space-y-4" @submit.prevent="submit">
        <p class="text-sm text-slate-600">{{ active?.user.name }} ({{ active?.user.email }}) ស្នើសុំ {{ khNum(active?.amount ?? 0) }} ក្រេឌីត</p>
        <div v-if="action === 'approve'">
          <label class="label" for="amt">ចំនួនដែលត្រូវផ្ដល់</label>
          <input id="amt" v-model.number="amount" type="number" min="1" class="input" required />
        </div>
        <div>
          <label class="label" for="note">កំណត់ចំណាំ (អ្នកប្រើនឹងឃើញ)</label>
          <input id="note" v-model="note" class="input" maxlength="300" />
        </div>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary" @click="active = null">បោះបង់</button>
          <button :class="action === 'approve' ? 'btn-primary' : 'btn-danger'" :disabled="saving">
            {{ action === 'approve' ? 'អនុម័ត និងផ្ដល់ក្រេឌីត' : 'បដិសេធ' }}
          </button>
        </div>
      </form>
    </Modal>
  </div>
</template>
