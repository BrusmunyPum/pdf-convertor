<script setup lang="ts">
import { mdiChevronLeft, mdiChevronRight } from '@mdi/js';
import { computed } from 'vue';
import Icon from './Icon.vue';
import { khNum } from '@/utils/format';

const props = defineProps<{ page: number; total: number; pageSize: number }>();
const emit = defineEmits<{ change: [page: number] }>();
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
</script>

<template>
  <div v-if="pages > 1" class="flex items-center justify-between gap-3 px-1 py-3 text-sm text-slate-500">
    <span>ទំព័រ {{ khNum(page) }} / {{ khNum(pages) }} · សរុប {{ khNum(total) }}</span>
    <div class="flex gap-1">
      <button class="btn-secondary btn-sm !px-2" :disabled="page <= 1" aria-label="មុន" @click="emit('change', page - 1)">
        <Icon :path="mdiChevronLeft" :size="18" />
      </button>
      <button class="btn-secondary btn-sm !px-2" :disabled="page >= pages" aria-label="បន្ទាប់" @click="emit('change', page + 1)">
        <Icon :path="mdiChevronRight" :size="18" />
      </button>
    </div>
  </div>
</template>
