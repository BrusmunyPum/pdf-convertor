import { defineStore } from 'pinia';
import { ref } from 'vue';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

export const useToast = defineStore('toast', () => {
  const items = ref<Toast[]>([]);
  let seq = 0;

  function push(kind: Toast['kind'], text: string, ms = 3500) {
    const id = ++seq;
    items.value.push({ id, kind, text });
    setTimeout(() => dismiss(id), ms);
  }

  function dismiss(id: number) {
    items.value = items.value.filter((t) => t.id !== id);
  }

  return {
    items,
    dismiss,
    success: (t: string) => push('success', t),
    error: (t: string) => push('error', t, 5000),
    info: (t: string) => push('info', t),
  };
});
