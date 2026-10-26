<script setup lang="ts">
import { mdiAlertCircleOutline, mdiCheckCircle, mdiClose, mdiDownload, mdiFilePdfBox, mdiTranslate } from '@mdi/js';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import Icon from '@/components/ui/Icon.vue';
import ProgressBar from '@/components/ui/ProgressBar.vue';
import { conversionsApi } from '@/api/conversions';
import type { ItemStatus, QueueItem } from '@/composables/useUploadQueue';
import { FORMATS } from '@/constants/formats';
import type { Job } from '@/types';
import { fileSize, khNum, stageKh, warningKh } from '@/utils/format';

const props = defineProps<{ item: QueueItem; job?: Job; status: ItemStatus }>();
defineEmits<{ remove: [] }>();

const progress = computed(() => {
  if (props.status === 'uploading') return Math.round(props.item.uploadPct * 0.3);
  if (props.status === 'queued') return 30;
  if (props.status === 'processing') return 30 + Math.round((props.job?.progress ?? 0) * 0.7);
  return 100;
});

const detail = computed(() => {
  switch (props.status) {
    case 'uploading': return `កំពុងផ្ទុកឡើង ${khNum(props.item.uploadPct)}%`;
    case 'queued': return 'កំពុងរង់ចាំក្នុងជួរ…';
    case 'processing': return stageKh(props.job?.stage);
    default: return '';
  }
});

const fmt = computed(() => (props.job ? FORMATS[props.job.targetFormat] : null));
const repaired = computed(() => !!(props.job?.quality?.repairedFonts?.length || props.job?.quality?.khmerOrderFixed));
const canRemove = computed(() => props.status !== 'queued' && props.status !== 'processing');
</script>

<template>
  <li class="rounded-xl border border-slate-200 bg-white p-3 transition-colors" :class="status === 'done' && 'border-emerald-200 bg-emerald-50/40'">
    <div class="flex items-center gap-3">
      <span class="relative grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600">
        <Icon :path="mdiFilePdfBox" :size="24" />
        <span v-if="status === 'done'" class="absolute -bottom-1 -right-1 rounded-full bg-white text-emerald-600 animate-pop">
          <Icon :path="mdiCheckCircle" :size="16" />
        </span>
      </span>

      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-medium text-slate-800" :title="item.name">{{ item.name }}</p>
        <p class="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
          <span>{{ fileSize(item.size) }}</span>
          <span v-if="job?.pageCount">· {{ khNum(job.pageCount) }} ទំព័រ</span>
          <span v-if="fmt" class="font-medium" :class="fmt.color">→ {{ fmt.ext }}</span>
          <span v-if="detail" class="text-brand-700">· {{ detail }}</span>
          <span v-if="status === 'done' && job?.outputSize" class="text-emerald-700">· {{ fileSize(job.outputSize) }}</span>
        </p>
      </div>

      <a
        v-if="status === 'done' && job?.available"
        :href="conversionsApi.downloadUrl(job.id)"
        class="btn-primary btn-sm !bg-emerald-600 hover:!bg-emerald-700"
        :title="job.outputName ?? ''"
      >
        <Icon :path="mdiDownload" :size="16" /> <span class="hidden sm:inline">ទាញយក</span>
      </a>
      <button v-if="canRemove" type="button" class="btn-ghost btn-sm !px-2" aria-label="ដកចេញពីបញ្ជី" @click="$emit('remove')">
        <Icon :path="mdiClose" :size="18" />
      </button>
    </div>

    <div v-if="status === 'uploading' || status === 'queued' || status === 'processing'" class="mt-2.5">
      <ProgressBar :value="progress" />
    </div>

    <p v-if="status === 'failed'" class="mt-2 flex items-start gap-1.5 text-xs text-red-700">
      <Icon :path="mdiAlertCircleOutline" :size="14" class="mt-0.5" />
      <span>
        {{ item.error || job?.error || 'ការបម្លែងបរាជ័យ' }}
        <RouterLink v-if="item.errorCode === 'NO_GUEST_CREDITS'" to="/register" class="ml-1 font-medium underline">ចុះឈ្មោះ</RouterLink>
        <RouterLink v-else-if="item.errorCode === 'NO_CREDITS'" to="/credits" class="ml-1 font-medium underline">ស្នើសុំក្រេឌីត</RouterLink>
      </span>
    </p>

    <ul v-if="status === 'done' && (repaired || job?.warnings?.length)" class="mt-2 space-y-0.5 text-xs">
      <li v-if="repaired" class="flex items-center gap-1.5 text-emerald-800">
        <Icon :path="mdiTranslate" :size="14" /> បានជួសជុលអក្សរខ្មែរ ឲ្យត្រឹមត្រូវតាម Unicode
      </li>
      <li v-for="w in job?.warnings" :key="w" class="flex items-start gap-1.5 text-amber-800">
        <Icon :path="mdiAlertCircleOutline" :size="14" class="mt-0.5" /> {{ warningKh(w) }}
      </li>
    </ul>
  </li>
</template>
