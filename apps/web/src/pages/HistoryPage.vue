<script setup lang="ts">
import { mdiDotsHorizontal, mdiDownload, mdiFileSwapOutline, mdiHistory, mdiMagnify, mdiTrashCanOutline } from '@mdi/js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';
import EmptyState from '@/components/ui/EmptyState.vue';
import Icon from '@/components/ui/Icon.vue';
import Modal from '@/components/ui/Modal.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { conversionsApi } from '@/api/conversions';
import { FORMATS } from '@/constants/formats';
import { STATUS } from '@/constants/labels';
import type { ApiError } from '@/services/http';
import { connected, realtime } from '@/services/realtime';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';
import type { Format, Job, Paged } from '@/types';
import { fileSize, khNum, timeAgo } from '@/utils/format';

const PAGE_SIZE = 15;
const session = useSession();
const toast = useToast();
const data = ref<Paged<Job> | null>(null);
const loading = ref(true);
const page = ref(1);
const status = ref('');
const q = ref('');
const menuFor = ref<string | null>(null);
const confirmDelete = ref<Job | null>(null);
let pollTimer: ReturnType<typeof setTimeout> | undefined;
let searchTimer: ReturnType<typeof setTimeout> | undefined;

const tabs = [
  { v: '', l: 'ទាំងអស់' },
  { v: 'COMPLETED', l: 'រួចរាល់' },
  { v: 'PROCESSING', l: 'កំពុងបម្លែង' },
  { v: 'FAILED', l: 'បរាជ័យ' },
];

async function load(silent = false) {
  if (!silent) loading.value = true;
  clearTimeout(pollTimer);
  try {
    data.value = await conversionsApi.list({ page: page.value, pageSize: PAGE_SIZE, status: status.value, q: q.value.trim() });
    // fallback when the live connection is down
    if (!connected.value && data.value.items.some((j) => j.status === 'QUEUED' || j.status === 'PROCESSING')) {
      pollTimer = setTimeout(() => load(true), 2500);
    }
  } catch (e) {
    toast.error((e as ApiError).message);
  } finally {
    loading.value = false;
  }
}

/** Does a job belong in the list as currently filtered? */
function matches(job: Job) {
  if (status.value && job.status !== status.value) return false;
  return !q.value.trim() || job.originalName.toLowerCase().includes(q.value.trim().toLowerCase());
}

// live updates: progress moves, new conversions appear at the top, deleted ones disappear
const offUpdate = realtime.on('job:update', (job) => {
  const list = data.value;
  if (!list) return;
  const i = list.items.findIndex((j) => j.id === job.id);
  if (i >= 0) {
    if (matches(job)) list.items[i] = job;
    else {
      list.items.splice(i, 1);
      list.total--;
    }
  } else if (page.value === 1 && matches(job)) {
    list.items.unshift(job);
    list.total++;
    if (list.items.length > PAGE_SIZE) list.items.pop();
  }
});
const offRemoved = realtime.on('job:removed', ({ id }) => {
  const list = data.value;
  const i = list?.items.findIndex((j) => j.id === id) ?? -1;
  if (list && i >= 0) {
    list.items.splice(i, 1);
    list.total--;
  }
});

watch(status, () => {
  page.value = 1;
  load();
});
watch(q, () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    page.value = 1;
    load();
  }, 350);
});
onMounted(load);
onBeforeUnmount(() => {
  clearTimeout(pollTimer);
  offUpdate();
  offRemoved();
});

async function reconvert(job: Job, fmt: Format) {
  menuFor.value = null;
  try {
    await conversionsApi.reconvert(job.id, fmt, { mode: job.options?.mode ?? 'flow', ocr: job.options?.ocr ?? 'auto' });
    toast.success(`កំពុងបម្លែងទៅជា ${FORMATS[fmt].label}`);
    if (page.value !== 1) {
      page.value = 1;
      load(true);
    }
  } catch (e) {
    toast.error((e as ApiError).message);
  }
}

async function remove() {
  const job = confirmDelete.value;
  if (!job) return;
  try {
    await conversionsApi.remove(job.id);
    toast.success('បានលុប');
    confirmDelete.value = null;
  } catch (e) {
    toast.error((e as ApiError).message);
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-10">
    <div class="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold text-slate-900">ប្រវត្តិការបម្លែង</h1>
        <p class="mt-1 text-sm text-slate-500">
          ឯកសារត្រូវរក្សាទុកមួយរយៈពេល ហើយលុបដោយស្វ័យប្រវត្តិ
          <template v-if="session.isGuest"> · <RouterLink to="/register" class="text-brand-700 hover:underline">ចុះឈ្មោះ</RouterLink> ដើម្បីរក្សាប្រវត្តិយូរជាងនេះ</template>
        </p>
      </div>
      <RouterLink to="/" class="btn-primary"><Icon :path="mdiFileSwapOutline" :size="18" /> បម្លែងថ្មី</RouterLink>
    </div>

    <div class="card">
      <div class="flex flex-col gap-3 border-b border-slate-100 p-3 sm:flex-row sm:items-center">
        <div class="flex gap-1 overflow-x-auto">
          <button
            v-for="t in tabs"
            :key="t.v"
            class="whitespace-nowrap rounded-lg px-3 py-1.5 text-sm transition"
            :class="status === t.v ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'"
            @click="status = t.v"
          >
            {{ t.l }}
          </button>
        </div>
        <div class="relative sm:ml-auto sm:w-64">
          <Icon :path="mdiMagnify" :size="18" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input v-model="q" class="input !py-2 !pl-9" placeholder="ស្វែងរកឈ្មោះឯកសារ…" />
        </div>
      </div>

      <div v-if="loading && !data" class="space-y-3 p-4">
        <div v-for="i in 4" :key="i" class="h-14 animate-pulse rounded-xl bg-slate-100" />
      </div>

      <EmptyState v-else-if="!data?.items.length" :icon="mdiHistory" title="មិនទាន់មានប្រវត្តិ" text="ឯកសារដែលអ្នកបម្លែងនឹងបង្ហាញនៅទីនេះ">
        <RouterLink to="/" class="btn-secondary btn-sm">ចាប់ផ្ដើមបម្លែង</RouterLink>
      </EmptyState>

      <TransitionGroup v-else name="list" tag="ul" class="divide-y divide-slate-100">
        <li v-for="job in data.items" :key="job.id" class="flex items-center gap-3 px-4 py-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-lg" :class="[FORMATS[job.targetFormat].bg, FORMATS[job.targetFormat].color]">
            <Icon :path="FORMATS[job.targetFormat].icon" :size="22" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-slate-800" :title="job.originalName">{{ job.originalName }}</p>
            <p class="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
              <span>PDF → {{ FORMATS[job.targetFormat].ext }}</span>
              <span>· {{ khNum(job.pageCount) }} ទំព័រ</span>
              <span v-if="job.outputSize">· {{ fileSize(job.outputSize) }}</span>
              <span>· {{ timeAgo(job.createdAt) }}</span>
            </p>
            <div v-if="job.status === 'PROCESSING' || job.status === 'QUEUED'" class="mt-1.5 h-1 w-40 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full rounded-full bg-brand-500 transition-[width] duration-500" :style="{ width: `${Math.max(job.progress, 5)}%` }" />
            </div>
            <p v-if="job.status === 'FAILED' && job.error" class="mt-0.5 text-xs text-red-600">{{ job.error }}</p>
          </div>
          <span class="badge hidden sm:inline-flex" :class="STATUS[job.status].cls">{{ STATUS[job.status].label }}</span>
          <a v-if="job.available" :href="conversionsApi.downloadUrl(job.id)" class="btn-secondary btn-sm" title="ទាញយក">
            <Icon :path="mdiDownload" :size="16" /> <span class="hidden sm:inline">ទាញយក</span>
          </a>
          <span v-else-if="job.status === 'COMPLETED'" class="text-xs text-slate-400">ផុតកំណត់</span>
          <div class="relative">
            <button class="btn-ghost btn-sm !px-2" aria-label="សកម្មភាព" @click.stop="menuFor = menuFor === job.id ? null : job.id">
              <Icon :path="mdiDotsHorizontal" :size="18" />
            </button>
            <Transition name="fade">
              <div v-if="menuFor === job.id" class="absolute right-0 z-20 mt-1 w-52 rounded-xl border border-slate-200 bg-white py-1 shadow-lg" @mouseleave="menuFor = null">
                <template v-if="job.canReconvert">
                  <p class="px-3 pb-1 pt-2 text-xs font-medium text-slate-400">បម្លែងម្ដងទៀតទៅជា</p>
                  <button
                    v-for="(f, key) in FORMATS"
                    :key="key"
                    class="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
                    @click="reconvert(job, key)"
                  >
                    <Icon :path="f.icon" :size="16" :class="f.color" /> {{ f.label }}
                  </button>
                </template>
                <button class="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-sm text-red-600 hover:bg-red-50" @click="confirmDelete = job; menuFor = null">
                  <Icon :path="mdiTrashCanOutline" :size="16" /> លុប
                </button>
              </div>
            </Transition>
          </div>
        </li>
      </TransitionGroup>

      <div v-if="data" class="border-t border-slate-100 px-3">
        <Pagination :page="data.page" :total="data.total" :page-size="data.pageSize" @change="(p) => { page = p; load(); }" />
      </div>
    </div>

    <Modal :open="!!confirmDelete" title="លុបឯកសារ?" @close="confirmDelete = null">
      <p class="text-sm text-slate-600">ឯកសារ <b class="break-all">{{ confirmDelete?.originalName }}</b> និងឯកសារដែលបានបម្លែងនឹងត្រូវលុបជាអចិន្ត្រៃយ៍។</p>
      <div class="mt-6 flex justify-end gap-2">
        <button class="btn-secondary" @click="confirmDelete = null">បោះបង់</button>
        <button class="btn-danger" @click="remove">លុប</button>
      </div>
    </Modal>
  </div>
</template>
