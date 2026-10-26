<script setup lang="ts">
import { mdiClose } from '@mdi/js';
import { onBeforeUnmount, watch } from 'vue';
import Icon from './Icon.vue';

const props = withDefaults(defineProps<{ open: boolean; title?: string; wide?: boolean }>(), { wide: false });
const emit = defineEmits<{ close: [] }>();

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close');
}
watch(
  () => props.open,
  (o) => {
    if (o) window.addEventListener('keydown', onKey);
    else window.removeEventListener('keydown', onKey);
    document.body.style.overflow = o ? 'hidden' : '';
  },
);
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey);
  document.body.style.overflow = '';
});
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4" @click.self="emit('close')">
        <div
          class="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-xl animate-fade-up sm:rounded-2xl"
          :class="wide ? 'sm:max-w-3xl' : 'sm:max-w-md'"
          role="dialog"
          aria-modal="true"
        >
          <div class="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
            <h3 class="font-semibold text-slate-900">{{ title }}</h3>
            <button class="btn-ghost btn-sm !px-2" aria-label="បិទ" @click="emit('close')"><Icon :path="mdiClose" :size="18" /></button>
          </div>
          <div class="p-5"><slot /></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
