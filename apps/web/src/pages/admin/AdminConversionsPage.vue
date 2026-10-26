<script setup lang="ts">
import { mdiDownload } from '@mdi/js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import Pagination from '@/components/ui/Pagination.vue';
import { api } from '@/services/http';
import type { Job, Paged } from '@/types';
import { connected, realtime } from '@/services/realtime';
import { fileSize, khNum, timeAgo, warningKh } from '@/utils/format';
import { FORMATS } from '@/constants/formats';
import { STATUS } from '@/constants/labels';

type Row = Job & { user: { id: string; name: string; email: string } | null; guest: boolean };

const data = ref<Paged<Row> | null>(null);
const page = ref(1);
const status = ref('');
const format = ref('');
const q = ref('');
let timer: ReturnType<typeof setTimeout> | undefined;

async function load() {
  clearTimeout(timer);
  const p = new URLSearchParams({ page: String(page.value), pageSize: '25' });
  if (status.value) p.set('status', status.value);
  if (format.value) p.set('format', format.value);
  if (q.value) p.set('q', q.value);
  data.value = await api<Paged<Row>>(`/admin/conversions?${p}`);
  if (!connected.value && data.value.items.some((j) => j.status === 'PROCESSING' || j.status === 'QUEUED')) timer = setTimeout(load, 3000);
}
watch([status, format, q], () => {
  page.value = 1;
  load();
});
onMounted(load);
// live: status/progress of visible rows, new jobs on the first page
const off = realtime.on('admin:job', (job) => {
  const list = data.value;
  if (!list) return;
  const i = list.items.findIndex((j) => j.id === job.id);
  if (i >= 0) list.items[i] = { ...list.items[i], ...job };
  else if (page.value === 1 && !status.value && !format.value && !q.value) load();
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  off();
});
</script>

<template>
  <div>
    <div class="card">
      <div class="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-3">
        <input v-model.lazy="q" class="input !py-2" placeholder="ឈ្មោះឯកសារ…" />
        <select v-model="status" class="input !py-2">
          <option value="">ស្ថានភាពទាំងអស់</option>
          <option v-for="(s, k) in STATUS" :key="k" :value="k">{{ s.label }}</option>
        </select>
        <select v-model="format" class="input !py-2">
          <option value="">ទម្រង់ទាំងអស់</option>
          <option v-for="(f, k) in FORMATS" :key="k" :value="k">{{ f.label }}</option>
        </select>
      </div>
      <div class="overflow-x-auto">
        <table class="table-base">
          <thead>
            <tr><th>ឯកសារ</th><th>អ្នកប្រើ</th><th>ទម្រង់</th><th class="text-right">ទំព័រ</th><th>ពេលវេលា</th><th>ស្ថានភាព</th><th></th></tr>
          </thead>
          <tbody>
            <tr v-for="j in data?.items" :key="j.id">
              <td class="max-w-[260px]">
                <p class="truncate font-medium" :title="j.originalName">{{ j.originalName }}</p>
                <p class="text-xs text-slate-400">{{ fileSize(j.inputSize) }} → {{ fileSize(j.outputSize) }} · {{ timeAgo(j.createdAt) }}</p>
                <p v-if="j.error" class="text-xs text-red-600">{{ j.error }}</p>
                <p v-for="w in j.warnings ?? []" :key="w" class="text-xs text-amber-700">{{ warningKh(w) }}</p>
              </td>
              <td>
                <template v-if="j.user">
                  <p class="text-sm">{{ j.user.name }}</p>
                  <p class="text-xs text-slate-400">{{ j.user.email }}</p>
                </template>
                <span v-else class="badge bg-slate-100 text-slate-500">ភ្ញៀវ</span>
              </td>
              <td>
                <span class="flex items-center gap-1.5">
                  <Icon :path="FORMATS[j.targetFormat].icon" :size="16" :class="FORMATS[j.targetFormat].color" /> {{ FORMATS[j.targetFormat].ext }}
                  <span v-if="j.options?.mode === 'exact'" class="text-xs text-slate-400">(ដូចដើម)</span>
                </span>
              </td>
              <td class="text-right tabular-nums">{{ khNum(j.pageCount) }}</td>
              <td class="whitespace-nowrap tabular-nums text-slate-500">{{ j.durationMs ? `${khNum((j.durationMs / 1000).toFixed(1))}s` : '—' }}</td>
              <td><span class="badge" :class="STATUS[j.status].cls">{{ STATUS[j.status].label }}</span></td>
              <td>
                <a v-if="j.available" :href="`/api/conversions/${j.id}/download`" class="btn-ghost btn-sm !px-2" title="ទាញយក"><Icon :path="mdiDownload" :size="16" /></a>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="data" class="px-4">
        <Pagination :page="data.page" :total="data.total" :page-size="data.pageSize" @change="(p) => { page = p; load(); }" />
      </div>
    </div>
  </div>
</template>
