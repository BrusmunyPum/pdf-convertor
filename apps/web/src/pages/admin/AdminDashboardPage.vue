<script setup lang="ts">
import {
  mdiAccountGroupOutline,
  mdiArrowRight,
  mdiCheckDecagramOutline,
  mdiCogOutline,
  mdiFileSwapOutline,
  mdiRefresh,
  mdiStarFourPointsOutline,
} from '@mdi/js';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';
import Icon from '@/components/ui/Icon.vue';
import { api } from '@/services/http';
import { realtime } from '@/services/realtime';
import type { Format, Job, Paged } from '@/types';
import { FORMATS } from '@/constants/formats';
import { STATUS } from '@/constants/labels';
import { useSession } from '@/stores/session';
import { khNum, shortDate, timeAgo } from '@/utils/format';

interface Stats {
  users: number;
  usersToday: number;
  jobs: number;
  jobsToday: number;
  successRate: number;
  pendingRequests: number;
  creditsGranted: number;
  byFormat: { format: Format; count: number }[];
  daily: { day: string; total: number; failed: number }[];
}
interface Req {
  id: string;
  code: string;
  amount: number;
  createdAt: string;
  user: { name: string; email: string };
}
type Row = Job & { user: { name: string; email: string } | null };

const session = useSession();
const s = ref<Stats | null>(null);
const requests = ref<Req[]>([]);
const recent = ref<Row[]>([]);
const refreshing = ref(false);

const loadStats = async () => (s.value = await api<Stats>('/admin/stats'));
const loadRequests = async () =>
  (requests.value = (await api<Paged<Req>>('/admin/credit-requests?status=PENDING&page=1&pageSize=5')).items);
const loadRecent = async () => (recent.value = (await api<Paged<Row>>('/admin/conversions?page=1&pageSize=6')).items);

async function refresh() {
  refreshing.value = true;
  try {
    await Promise.all([loadStats(), loadRequests(), loadRecent()]);
  } finally {
    refreshing.value = false;
  }
}
onMounted(refresh);

// live: requests and conversions update while the page is open (stats are coalesced to one reload)
let statsTimer: ReturnType<typeof setTimeout> | undefined;
const reloadStatsSoon = () => {
  clearTimeout(statsTimer);
  statsTimer = setTimeout(loadStats, 1500);
};
const offReq = realtime.on('admin:credit-request', () => {
  loadRequests();
  reloadStatsSoon();
});
const offJob = realtime.on('admin:job', (job) => {
  const i = recent.value.findIndex((j) => j.id === job.id);
  if (i >= 0) recent.value[i] = { ...recent.value[i], ...job };
  else loadRecent();
  if (job.status === 'COMPLETED' || job.status === 'FAILED') reloadStatsSoon();
});
onBeforeUnmount(() => {
  clearTimeout(statsTimer);
  offReq();
  offJob();
});

const greeting = computed(() => {
  const h = new Date().getHours();
  return h < 12 ? 'អរុណសួស្តី' : h < 17 ? 'ទិវាសួស្តី' : 'សាយណ្ហសួស្តី';
});
// spelled out by hand: not every browser ships Khmer date names for Intl
const KH_DAYS = ['អាទិត្យ', 'ច័ន្ទ', 'អង្គារ', 'ពុធ', 'ព្រហស្បតិ៍', 'សុក្រ', 'សៅរ៍'];
const KH_MONTHS = ['មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា', 'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'];
const now = new Date();
const today = `ថ្ងៃ${KH_DAYS[now.getDay()]} ទី${khNum(now.getDate())} ខែ${KH_MONTHS[now.getMonth()]} ឆ្នាំ${khNum(now.getFullYear())}`;

// fill missing days so the chart always shows 14 bars
const days = computed(() => {
  const map = new Map((s.value?.daily ?? []).map((d) => [new Date(d.day).toDateString(), d]));
  return Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - i));
    const d = map.get(date.toDateString());
    return { date, total: d?.total ?? 0, failed: d?.failed ?? 0 };
  });
});
const maxDay = computed(() => Math.max(1, ...days.value.map((d) => d.total)));
const periodTotal = computed(() => days.value.reduce((n, d) => n + d.total, 0));
const periodFailed = computed(() => days.value.reduce((n, d) => n + d.failed, 0));

const formats = computed(() => [...(s.value?.byFormat ?? [])].sort((a, b) => b.count - a.count));
const formatTotal = computed(() => Math.max(1, formats.value.reduce((n, f) => n + f.count, 0)));

const cards = computed(() =>
  s.value
    ? [
        { label: 'អ្នកប្រើប្រាស់', value: khNum(s.value.users), sub: `+${khNum(s.value.usersToday)} ថ្ងៃនេះ`, icon: mdiAccountGroupOutline, cls: 'bg-brand-50 text-brand-600', bar: 'bg-brand-600', to: '/admin/users' },
        { label: 'ការបម្លែងសរុប', value: khNum(s.value.jobs), sub: `+${khNum(s.value.jobsToday)} ថ្ងៃនេះ`, icon: mdiFileSwapOutline, cls: 'bg-sky-50 text-sky-600', bar: 'bg-sky-500', to: '/admin/conversions' },
        { label: 'អត្រាជោគជ័យ', value: `${khNum((s.value.successRate * 100).toFixed(1))}%`, sub: 'ការបម្លែងដែលរួចរាល់', icon: mdiCheckDecagramOutline, cls: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500', to: '/admin/conversions' },
        { label: 'សំណើរង់ចាំ', value: khNum(s.value.pendingRequests), sub: `បានផ្ដល់ ${khNum(s.value.creditsGranted)} ក្រេឌីត`, icon: mdiStarFourPointsOutline, cls: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500', to: '/admin/requests' },
      ]
    : [],
);
</script>

<template>
  <div class="space-y-5">
    <!-- Welcome banner -->
    <div class="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-brand-800 p-5 text-white shadow-sm sm:p-6">
      <img src="/assets/logo-mark-transparent.png" alt="" class="pointer-events-none absolute -bottom-8 -right-6 h-40 w-40 rotate-6 opacity-15 sm:h-48 sm:w-48" />
      <div class="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p class="text-xs text-white/70">{{ today }}</p>
          <h1 class="mt-1 text-xl font-bold tracking-tight sm:text-2xl">{{ greeting }}, {{ session.user?.name }}</h1>
          <p class="mt-1 text-sm text-white/80">
            <template v-if="s">ថ្ងៃនេះមានការបម្លែង {{ khNum(s.jobsToday) }} និងអ្នកប្រើថ្មី {{ khNum(s.usersToday) }} នាក់</template>
            <template v-else>កំពុងទាញយកទិន្នន័យ...</template>
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <RouterLink
            to="/admin/requests"
            class="inline-flex items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-sm font-medium text-brand-700 shadow-sm transition hover:bg-brand-50"
          >
            <Icon :path="mdiStarFourPointsOutline" :size="18" class="text-amber-500" />
            ពិនិត្យសំណើ
            <span v-if="session.pendingRequests" class="grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-bold text-white">{{ khNum(session.pendingRequests) }}</span>
          </RouterLink>
          <RouterLink to="/admin/settings" class="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3.5 py-2 text-sm font-medium text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25">
            <Icon :path="mdiCogOutline" :size="18" /> ការកំណត់
          </RouterLink>
          <button
            class="inline-flex items-center gap-2 rounded-xl bg-white/15 px-3 py-2 text-sm text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white/25 disabled:opacity-60"
            title="ផ្ទុកឡើងវិញ"
            :disabled="refreshing"
            @click="refresh"
          >
            <Icon :path="mdiRefresh" :size="18" :class="refreshing && 'animate-spin'" />
          </button>
        </div>
      </div>
    </div>

    <div v-if="!s" class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div v-for="i in 4" :key="i" class="h-32 animate-pulse rounded-2xl bg-white ring-1 ring-slate-200" />
    </div>
    <template v-else>
      <!-- KPI cards -->
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <RouterLink
          v-for="(c, i) in cards"
          :key="c.label"
          :to="c.to"
          class="card group relative overflow-hidden p-5 transition animate-fade-up hover:-translate-y-0.5 hover:shadow-md"
          :style="{ animationDelay: `${i * 50}ms` }"
        >
          <span class="absolute inset-x-0 top-0 h-1" :class="c.bar" />
          <div class="flex items-start justify-between">
            <div>
              <p class="text-sm text-slate-500">{{ c.label }}</p>
              <p class="mt-1.5 text-2xl font-bold tabular-nums text-slate-900">{{ c.value }}</p>
            </div>
            <span class="grid h-11 w-11 place-items-center rounded-xl" :class="c.cls"><Icon :path="c.icon" :size="22" /></span>
          </div>
          <p class="mt-2 flex items-center justify-between text-xs text-slate-500">
            {{ c.sub }}
            <Icon :path="mdiArrowRight" :size="14" class="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-slate-500" />
          </p>
        </RouterLink>
      </div>

      <div class="grid gap-5 xl:grid-cols-3">
        <!-- 14-day chart -->
        <div class="card p-5 xl:col-span-2">
          <div class="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <p class="font-semibold text-slate-800">ការបម្លែង ១៤ ថ្ងៃចុងក្រោយ</p>
              <p class="text-xs text-slate-500">សរុប {{ khNum(periodTotal) }} · បរាជ័យ {{ khNum(periodFailed) }}</p>
            </div>
            <div class="flex items-center gap-3 text-xs text-slate-500">
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-brand-500" /> ជោគជ័យ</span>
              <span class="flex items-center gap-1.5"><span class="h-2.5 w-2.5 rounded-sm bg-rose-400" /> បរាជ័យ</span>
            </div>
          </div>
          <div class="relative h-52">
            <!-- gridlines -->
            <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
              <div v-for="g in 4" :key="g" class="border-t border-dashed border-slate-100" />
              <div class="border-t border-slate-200" />
            </div>
            <div class="relative flex h-full items-end gap-1.5">
              <div v-for="d in days" :key="d.date.toISOString()" class="group relative flex h-full flex-1 flex-col justify-end">
                <div
                  class="flex w-full flex-col overflow-hidden rounded-t-md transition-all duration-500"
                  :style="{ height: `${(d.total / maxDay) * 100}%`, minHeight: d.total ? '4px' : '0' }"
                >
                  <div class="w-full bg-rose-400" :style="{ height: d.total ? `${(d.failed / d.total) * 100}%` : '0' }" />
                  <div class="w-full flex-1 bg-brand-500 transition-colors group-hover:bg-brand-600" />
                </div>
                <div class="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-xs text-white shadow group-hover:block">
                  {{ shortDate(d.date) }}: {{ khNum(d.total) }} · បរាជ័យ {{ khNum(d.failed) }}
                </div>
              </div>
            </div>
          </div>
          <div class="mt-2 flex gap-1.5 text-center text-[10px] text-slate-400">
            <span v-for="(d, i) in days" :key="i" class="flex-1 truncate">{{ i % 2 === 1 ? shortDate(d.date) : '' }}</span>
          </div>
        </div>

        <!-- By format -->
        <div class="card p-5">
          <p class="font-semibold text-slate-800">តាមទម្រង់</p>
          <p class="mb-4 text-xs text-slate-500">ចំណែកនៃការបម្លែងទាំងអស់</p>
          <p v-if="!formats.length" class="py-8 text-center text-sm text-slate-500">មិនទាន់មានទិន្នន័យ</p>
          <ul class="space-y-3.5">
            <li v-for="f in formats" :key="f.format">
              <div class="mb-1.5 flex items-center justify-between text-sm">
                <span class="flex items-center gap-2">
                  <span class="grid h-7 w-7 place-items-center rounded-lg" :class="FORMATS[f.format].bg">
                    <Icon :path="FORMATS[f.format].icon" :size="16" :class="FORMATS[f.format].color" />
                  </span>
                  {{ FORMATS[f.format].label }}
                </span>
                <span class="tabular-nums text-slate-500">
                  {{ khNum(f.count) }} <span class="text-xs text-slate-400">({{ khNum(Math.round((f.count / formatTotal) * 100)) }}%)</span>
                </span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div class="h-full rounded-full bg-brand-600 transition-all duration-700" :style="{ width: `${(f.count / formatTotal) * 100}%` }" />
              </div>
            </li>
          </ul>
        </div>
      </div>

      <div class="grid gap-5 xl:grid-cols-3">
        <!-- Pending credit requests -->
        <div class="card overflow-hidden">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <p class="font-semibold text-slate-800">សំណើក្រេឌីតរង់ចាំ</p>
            <RouterLink to="/admin/requests" class="text-xs font-medium text-brand-600 hover:text-brand-700">មើលទាំងអស់</RouterLink>
          </div>
          <p v-if="!requests.length" class="px-5 py-10 text-center text-sm text-slate-500">មិនមានសំណើរង់ចាំទេ</p>
          <ul v-else class="divide-y divide-slate-100">
            <li v-for="r in requests" :key="r.id">
              <RouterLink to="/admin/requests" class="flex items-center gap-3 px-5 py-3 transition hover:bg-slate-50">
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-amber-50 text-sm font-semibold text-amber-700">
                  {{ r.user.name.slice(0, 1).toUpperCase() }}
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-slate-800">{{ r.user.name }}</span>
                  <span class="block truncate text-xs text-slate-400">{{ r.code }} · {{ timeAgo(r.createdAt) }}</span>
                </span>
                <span class="badge bg-amber-50 text-amber-700">+{{ khNum(r.amount) }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>

        <!-- Recent conversions -->
        <div class="card overflow-hidden xl:col-span-2">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <p class="font-semibold text-slate-800">ការបម្លែងថ្មីៗ</p>
            <RouterLink to="/admin/conversions" class="text-xs font-medium text-brand-600 hover:text-brand-700">មើលទាំងអស់</RouterLink>
          </div>
          <p v-if="!recent.length" class="px-5 py-10 text-center text-sm text-slate-500">មិនទាន់មានការបម្លែង</p>
          <ul v-else class="divide-y divide-slate-100">
            <li v-for="j in recent" :key="j.id" class="flex items-center gap-3 px-5 py-3">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl" :class="FORMATS[j.targetFormat].bg">
                <Icon :path="FORMATS[j.targetFormat].icon" :size="18" :class="FORMATS[j.targetFormat].color" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-slate-800" :title="j.originalName">{{ j.originalName }}</span>
                <span class="block truncate text-xs text-slate-400">
                  {{ j.user?.name ?? 'ភ្ញៀវ' }} · {{ khNum(j.pageCount) }} ទំព័រ · {{ timeAgo(j.createdAt) }}
                </span>
              </span>
              <span class="badge shrink-0" :class="STATUS[j.status].cls">
                {{ STATUS[j.status].label }}<template v-if="j.status === 'PROCESSING'"> {{ khNum(j.progress) }}%</template>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </template>
  </div>
</template>
