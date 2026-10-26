<script setup lang="ts">
withDefaults(defineProps<{ value: number; tone?: 'brand' | 'emerald' | 'red' }>(), { tone: 'brand' });
const tones = { brand: 'bg-brand-600', emerald: 'bg-emerald-500', red: 'bg-red-500' };
</script>

<template>
  <div class="h-1.5 overflow-hidden rounded-full bg-slate-100" role="progressbar" :aria-valuenow="value" aria-valuemin="0" aria-valuemax="100">
    <div class="relative h-full rounded-full transition-[width] duration-500 ease-out" :class="tones[tone]" :style="{ width: `${Math.max(3, Math.min(100, value))}%` }">
      <div v-if="value < 100" class="absolute inset-0 animate-pulse bg-white/25" />
    </div>
  </div>
</template>
