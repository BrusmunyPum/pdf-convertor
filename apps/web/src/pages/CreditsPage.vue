<script setup lang="ts">
import { mdiCheckCircleOutline, mdiSend, mdiStarFourPointsOutline } from '@mdi/js';
import { onMounted, ref } from 'vue';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { api, type ApiError } from '@/services/http';
import type { Paged } from '@/types';
import { dateTime, khNum } from '@/utils/format';
import { REQ_STATUS, TX_TYPES } from '@/constants/labels';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';

interface Tx { id: string; amount: number; balanceAfter: number; type: string; note: string | null; createdAt: string }
interface CreditRequest {
  id: string;
  code: string;
  amount: number;
  grantedAmount: number | null;
  message: string | null;
  status: string;
  adminNote: string | null;
  createdAt: string;
  telegramUrl?: string | null;
}

const session = useSession();
const toast = useToast();
const amount = ref(20);
const message = ref('');
const sending = ref(false);
const created = ref<CreditRequest | null>(null);
const requests = ref<CreditRequest[]>([]);
const txs = ref<Paged<Tx> | null>(null);
const txPage = ref(1);
const presets = [10, 20, 50, 100];

async function load() {
  const [r, t] = await Promise.all([
    api<CreditRequest[]>('/credits/requests'),
    api<Paged<Tx>>(`/credits/transactions?page=${txPage.value}&pageSize=10`),
  ]);
  requests.value = r;
  txs.value = t;
  session.refresh();
}
onMounted(load);

function telegramLink(code: string, amt: number) {
  const u = session.config?.telegramUsername;
  if (!u) return null;
  const text = `សួស្តី! ខ្ញុំសូមស្នើសុំក្រេឌីត ${amt}។\nលេខកូដសំណើ: ${code}\nអ៊ីមែល: ${session.user?.email}`;
  return `https://t.me/${u}?text=${encodeURIComponent(text)}`;
}

async function submit() {
  sending.value = true;
  try {
    created.value = await api<CreditRequest>('/credits/requests', { method: 'POST', json: { amount: amount.value, message: message.value || undefined } });
    message.value = '';
    toast.success('បានបង្កើតសំណើ។ សូមផ្ញើទៅអ្នកគ្រប់គ្រងតាម Telegram');
    load();
  } catch (e) {
    toast.error((e as ApiError).message);
  } finally {
    sending.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <h1 class="mb-6 text-2xl font-semibold text-slate-900">ក្រេឌីត</h1>

    <div class="grid gap-5 lg:grid-cols-5">
      <div class="space-y-5 lg:col-span-2">
        <div class="card relative overflow-hidden p-6 animate-fade-up">
          <div class="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-amber-50" />
          <p class="relative text-sm text-slate-500">សមតុល្យបច្ចុប្បន្ន</p>
          <p class="relative mt-1 flex items-baseline gap-2">
            <span class="text-4xl font-semibold tabular-nums text-slate-900">{{ khNum(session.credits) }}</span>
            <span class="text-slate-500">ក្រេឌីត</span>
          </p>
          <p class="relative mt-3 text-sm text-slate-500">
            <Icon :path="mdiStarFourPointsOutline" :size="14" class="inline text-amber-500" />
            ១ ឯកសារ = {{ khNum(session.config?.creditCost ?? 1) }} ក្រេឌីត · បរាជ័យ = បង្វិលសងវិញ
          </p>
        </div>

        <div class="card p-6 animate-fade-up" style="animation-delay: 60ms">
          <h2 class="font-semibold text-slate-900">ស្នើសុំក្រេឌីតបន្ថែម</h2>
          <p class="mt-1 text-sm text-slate-500">មិនចាំបាច់បង់ប្រាក់អនឡាញ — ផ្ញើសំណើ រួចទាក់ទងអ្នកគ្រប់គ្រងផ្ទាល់តាម Telegram។</p>

          <Transition name="fade" mode="out-in">
            <div v-if="created" class="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <p class="flex items-center gap-2 font-medium text-emerald-900">
                <Icon :path="mdiCheckCircleOutline" class="text-emerald-600" /> សំណើ {{ created.code }}
              </p>
              <p class="mt-1 text-sm text-emerald-800/80">ចុចប៊ូតុងខាងក្រោម ដើម្បីផ្ញើលេខកូដនេះទៅអ្នកគ្រប់គ្រង។</p>
              <a v-if="created.telegramUrl" :href="created.telegramUrl" target="_blank" rel="noopener" class="btn-primary mt-3 w-full !bg-[#229ED9] hover:!bg-[#1b8cc2]">
                <Icon :path="mdiSend" :size="18" /> ផ្ញើតាម Telegram
              </a>
              <button class="btn-ghost btn-sm mt-2 w-full" @click="created = null">ស្នើសុំម្ដងទៀត</button>
            </div>
            <form v-else class="mt-5 space-y-4" @submit.prevent="submit">
              <div>
                <p class="label">ចំនួនក្រេឌីត</p>
                <div class="grid grid-cols-4 gap-2">
                  <button
                    v-for="p in presets"
                    :key="p"
                    type="button"
                    class="rounded-xl border py-2 text-sm font-medium transition"
                    :class="amount === p ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 hover:border-slate-300'"
                    @click="amount = p"
                  >
                    {{ khNum(p) }}
                  </button>
                </div>
                <input v-model.number="amount" type="number" min="1" max="10000" class="input mt-2" required />
              </div>
              <div>
                <label class="label" for="msg">សារ (មិនចាំបាច់)</label>
                <textarea id="msg" v-model="message" rows="2" maxlength="500" class="input" placeholder="ឧ. ត្រូវការសម្រាប់បម្លែងឯកសារការងារ" />
              </div>
              <button class="btn-primary w-full" :disabled="sending || !amount">ផ្ញើសំណើ</button>
            </form>
          </Transition>
        </div>
      </div>

      <div class="space-y-5 lg:col-span-3">
        <div class="card animate-fade-up" style="animation-delay: 90ms">
          <h2 class="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">សំណើរបស់ខ្ញុំ</h2>
          <p v-if="!requests.length" class="px-5 py-8 text-center text-sm text-slate-500">មិនទាន់មានសំណើ</p>
          <ul v-else class="divide-y divide-slate-100">
            <li v-for="r in requests" :key="r.id" class="flex items-center gap-3 px-5 py-3 text-sm">
              <div class="min-w-0 flex-1">
                <p class="font-medium text-slate-800">{{ r.code }} · {{ khNum(r.grantedAmount ?? r.amount) }} ក្រេឌីត</p>
                <p class="text-xs text-slate-500">{{ dateTime(r.createdAt) }}<template v-if="r.adminNote"> · {{ r.adminNote }}</template></p>
              </div>
              <a
                v-if="r.status === 'PENDING' && telegramLink(r.code, r.amount)"
                :href="telegramLink(r.code, r.amount)!"
                target="_blank"
                rel="noopener"
                class="btn-ghost btn-sm text-[#229ED9]"
                title="ផ្ញើតាម Telegram"
              >
                <Icon :path="mdiSend" :size="16" />
              </a>
              <span class="badge" :class="REQ_STATUS[r.status].cls">{{ REQ_STATUS[r.status].label }}</span>
            </li>
          </ul>
        </div>

        <div class="card animate-fade-up" style="animation-delay: 120ms">
          <h2 class="border-b border-slate-100 px-5 py-4 font-semibold text-slate-900">ប្រវត្តិក្រេឌីត</h2>
          <EmptyState v-if="txs && !txs.items.length" :icon="mdiStarFourPointsOutline" title="មិនទាន់មានប្រតិបត្តិការ" />
          <div v-else class="overflow-x-auto">
            <table class="table-base">
              <thead>
                <tr><th>កាលបរិច្ឆេទ</th><th>ប្រភេទ</th><th class="text-right">ចំនួន</th><th class="text-right">សមតុល្យ</th></tr>
              </thead>
              <tbody>
                <tr v-for="t in txs?.items" :key="t.id">
                  <td class="whitespace-nowrap text-slate-500">{{ dateTime(t.createdAt) }}</td>
                  <td>{{ TX_TYPES[t.type] ?? t.type }}</td>
                  <td class="text-right font-medium tabular-nums" :class="t.amount > 0 ? 'text-emerald-600' : 'text-slate-700'">
                    {{ t.amount > 0 ? '+' : '' }}{{ khNum(t.amount) }}
                  </td>
                  <td class="text-right tabular-nums text-slate-500">{{ khNum(t.balanceAfter) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="txs" class="px-4">
            <Pagination :page="txs.page" :total="txs.total" :page-size="txs.pageSize" @change="(p) => { txPage = p; load(); }" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
