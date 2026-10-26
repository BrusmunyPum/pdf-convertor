<script setup lang="ts">
import Icon from './Icon.vue';
defineProps<{ icon: string; title: string; text?: string }>();
</script>

<template>
  <div class="flex flex-col items-center justify-center px-6 py-14 text-center animate-fade-up">
    <div class="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-slate-100 text-slate-400">
      <Icon :path="icon" :size="28" />
    </div>
    <p class="font-medium text-slate-700">{{ title }}</p>
    <p v-if="text" class="mt-1 max-w-sm text-sm text-slate-500">{{ text }}</p>
    <div class="mt-5"><slot /></div>
  </div>
</template>
