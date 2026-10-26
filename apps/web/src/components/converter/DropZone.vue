<script setup lang="ts">
import { mdiCloudUploadOutline, mdiPlus } from '@mdi/js';
import { ref } from 'vue';
import Icon from '@/components/ui/Icon.vue';
import { khNum } from '@/utils/format';

/** Drop or pick one or many PDFs. `compact` is the slim "add more" bar shown once files are listed. */
defineProps<{ compact?: boolean; maxMb: number; maxPages: number; maxFiles: number }>();
const emit = defineEmits<{ files: [files: FileList] }>();

const dragging = ref(false);
const input = ref<HTMLInputElement | null>(null);

function onDrop(e: DragEvent) {
  dragging.value = false;
  if (e.dataTransfer?.files?.length) emit('files', e.dataTransfer.files);
}
function onPick(e: Event) {
  const el = e.target as HTMLInputElement;
  if (el.files?.length) emit('files', el.files);
  el.value = ''; // allow picking the same file again
}
</script>

<template>
  <div
    role="button"
    tabindex="0"
    class="cursor-pointer border-2 border-dashed transition-all duration-200"
    :class="[
      compact ? 'flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm' : 'flex flex-col items-center justify-center rounded-2xl px-6 py-12 text-center',
      dragging ? 'scale-[1.01] border-brand-500 bg-brand-50' : 'border-slate-200 bg-slate-50/50 hover:border-brand-300 hover:bg-brand-50/30',
    ]"
    @click="input?.click()"
    @keydown.enter.prevent="input?.click()"
    @keydown.space.prevent="input?.click()"
    @dragover.prevent="dragging = true"
    @dragleave.prevent="dragging = false"
    @drop.prevent="onDrop"
  >
    <template v-if="compact">
      <Icon :path="mdiPlus" :size="18" class="text-brand-600" />
      <span class="font-medium text-slate-700">បន្ថែមឯកសារ PDF</span>
      <span class="hidden text-slate-400 sm:inline">ឬទាញមកទីនេះ</span>
    </template>
    <template v-else>
      <div class="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-white text-brand-600 shadow-sm transition-transform" :class="dragging && '-translate-y-1'">
        <Icon :path="mdiCloudUploadOutline" :size="30" />
      </div>
      <p class="font-medium text-slate-800">ទាញឯកសារ PDF មកទីនេះ ឬ <span class="text-brand-600">ចុចដើម្បីជ្រើសរើស</span></p>
      <p class="mt-1 text-sm text-slate-500">
        ជ្រើសបានច្រើនឯកសារ (រហូតដល់ {{ khNum(maxFiles) }}) · ម្នាក់ៗ {{ khNum(maxMb) }}MB · {{ khNum(maxPages) }} ទំព័រ
      </p>
    </template>
    <input ref="input" type="file" accept="application/pdf,.pdf" multiple class="hidden" @change="onPick" />
  </div>
</template>
