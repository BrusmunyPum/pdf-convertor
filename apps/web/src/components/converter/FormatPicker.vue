<script setup lang="ts">
import { mdiCheckBold } from '@mdi/js';
import Icon from '@/components/ui/Icon.vue';
import { FORMATS } from '@/constants/formats';
import type { Format } from '@/types';

defineProps<{ disabled?: boolean }>();
const model = defineModel<Format>({ required: true });
</script>

<template>
  <div>
    <div class="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7" role="radiogroup" aria-label="ទម្រង់ឯកសារ">
      <button
        v-for="(f, key) in FORMATS"
        :key="key"
        type="button"
        role="radio"
        :aria-checked="model === key"
        :disabled="disabled"
        class="group relative flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all duration-150 disabled:opacity-60"
        :class="model === key ? 'border-brand-500 bg-brand-50/60 ring-2 ring-brand-100' : 'border-slate-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-sm'"
        @click="model = key"
      >
        <span class="grid h-10 w-10 place-items-center rounded-lg transition-transform group-hover:scale-105" :class="[f.bg, f.color]">
          <Icon :path="f.icon" :size="24" />
        </span>
        <span class="text-sm font-medium text-slate-800">{{ f.label }}</span>
        <span class="text-[11px] font-medium tracking-wide text-slate-400">{{ f.ext }}</span>
        <span v-if="model === key" class="absolute right-1.5 top-1.5 grid h-4 w-4 place-items-center rounded-full bg-brand-600 text-white animate-pop">
          <Icon :path="mdiCheckBold" :size="10" />
        </span>
      </button>
    </div>
    <p class="mt-3 text-sm text-slate-500">{{ FORMATS[model].desc }}</p>
  </div>
</template>
