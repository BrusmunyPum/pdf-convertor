<script setup lang="ts">
import { mdiAlertCircleOutline, mdiCheckCircleOutline, mdiClose, mdiInformationOutline } from '@mdi/js';
import Icon from './Icon.vue';
import { useToast } from '@/stores/toast';

const toast = useToast();
const icons = { success: mdiCheckCircleOutline, error: mdiAlertCircleOutline, info: mdiInformationOutline };
const colors = { success: 'text-emerald-600', error: 'text-red-600', info: 'text-brand-600' };
</script>

<template>
  <div class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
    <TransitionGroup name="list">
      <div
        v-for="t in toast.items"
        :key="t.id"
        class="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-lg shadow-slate-900/5"
        role="status"
      >
        <Icon :path="icons[t.kind]" :class="colors[t.kind]" class="mt-0.5" />
        <p class="flex-1 text-slate-700">{{ t.text }}</p>
        <button class="text-slate-400 hover:text-slate-600" aria-label="បិទ" @click="toast.dismiss(t.id)">
          <Icon :path="mdiClose" :size="16" />
        </button>
      </div>
    </TransitionGroup>
  </div>
</template>
