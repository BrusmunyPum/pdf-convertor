<script setup lang="ts">
import { useSession } from '@/stores/session';

const session = useSession();
</script>

<template>
<footer class="border-t border-slate-200 bg-white">
  <div class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-6 text-sm text-slate-500 sm:flex-row">
    <p>រក្សាសិទ្ធិគ្រប់យ៉ាង © {{ new Date().getFullYear() }} DIGITECHKH ·ឯកសាររបស់អ្នកត្រូវលុបដោយស្វ័យប្រវត្តិ</p>
    <a
      v-if="session.config?.telegramUsername"
      :href="`https://t.me/${session.config.telegramUsername}`"
      target="_blank"
      rel="noopener"
      class="hover:text-brand-700"
    >ទំនាក់ទំនងតាម Telegram</a>
  </div>
</footer>
</template>
