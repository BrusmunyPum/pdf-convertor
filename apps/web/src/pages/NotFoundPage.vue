<script setup lang="ts">
import { mdiFileQuestionOutline } from '@mdi/js';
import { RouterLink } from 'vue-router';
import EmptyState from '@/components/ui/EmptyState.vue';
</script>

<template>
  <div class="mx-auto max-w-lg px-4 py-20">
    <EmptyState :icon="mdiFileQuestionOutline" title="រកមិនឃើញទំព័រនេះទេ" text="ទំព័រដែលអ្នកកំពុងស្វែងរកមិនមាន ឬត្រូវបានផ្លាស់ទី។">
      <RouterLink to="/" class="btn-primary">ត្រឡប់ទៅទំព័រដើម</RouterLink>
    </EmptyState>
  </div>
</template>
