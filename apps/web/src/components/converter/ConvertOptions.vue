<script setup lang="ts">
import { mdiChevronDown, mdiLockOutline } from '@mdi/js';
import Icon from '@/components/ui/Icon.vue';
import type { ConvertOptions, Format } from '@/types';

defineProps<{ target: Format }>();
const model = defineModel<ConvertOptions>({ required: true });
const open = defineModel<boolean>('open', { default: false });

const modes = [
  { v: 'flow', t: 'អាចកែសម្រួលបាន', d: 'កថាខណ្ឌ តារាង រូបភាព ហូរតាមធម្មតា — ល្អសម្រាប់កែអត្ថបទ' },
  { v: 'exact', t: 'ដូចដើម ១០០%', d: 'ប្លង់នីមួយៗនៅទីតាំងដើម — អត្ថបទនៅតែកែបាន' },
] as const;
</script>

<template>
  <div>
    <button type="button" class="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900" :aria-expanded="open" @click="open = !open">
      <Icon :path="mdiChevronDown" :size="18" class="transition-transform" :class="open && 'rotate-180'" />
      ជម្រើសបន្ថែម
    </button>
    <Transition name="fade">
      <div v-if="open" class="mt-3 grid gap-4 rounded-xl border border-slate-200 p-4 sm:grid-cols-2">
        <div v-if="target === 'docx'" class="sm:col-span-2">
          <p class="label">របៀបបម្លែង Word</p>
          <div class="grid gap-2 sm:grid-cols-2">
            <label
              v-for="m in modes"
              :key="m.v"
              class="cursor-pointer rounded-xl border p-3 transition"
              :class="model.mode === m.v ? 'border-brand-500 bg-brand-50/50' : 'border-slate-200 hover:border-slate-300'"
            >
              <input v-model="model.mode" type="radio" :value="m.v" class="sr-only" />
              <span class="block text-sm font-medium text-slate-800">{{ m.t }}</span>
              <span class="block text-xs text-slate-500">{{ m.d }}</span>
            </label>
          </div>
        </div>
        <div>
          <label class="label" for="opt-ocr">ស្គាល់អក្សរពីរូបភាព (OCR)</label>
          <select id="opt-ocr" v-model="model.ocr" class="input">
            <option value="auto">ស្វ័យប្រវត្តិ (ណែនាំ)</option>
            <option value="force">បង្ខំ OCR គ្រប់ទំព័រ</option>
            <option value="off">បិទ</option>
          </select>
        </div>
        <div>
          <label class="label" for="opt-pw">ពាក្យសម្ងាត់ PDF (បើមាន)</label>
          <div class="relative">
            <Icon :path="mdiLockOutline" :size="16" class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input id="opt-pw" v-model="model.password" type="password" autocomplete="off" class="input !pl-9" placeholder="—" />
          </div>
          <p class="mt-1 text-xs text-slate-500">ប្រើសម្រាប់គ្រប់ឯកសារក្នុងបញ្ជី</p>
        </div>
      </div>
    </Transition>
  </div>
</template>
