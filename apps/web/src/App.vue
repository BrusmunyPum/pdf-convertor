<script setup lang="ts">
import { RouterView, useRoute } from 'vue-router';
import AppFooter from '@/components/layout/AppFooter.vue';
import AppHeader from '@/components/layout/AppHeader.vue';
import ToastHost from '@/components/ui/ToastHost.vue';

// Full-screen pages (login, register) draw their own brand frame
const route = useRoute();
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <AppHeader v-if="!route.meta.bare" />

    <main class="flex-1">
      <RouterView v-slot="{ Component }">
        <Transition name="page" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <AppFooter v-if="!route.meta.bare" />
    <ToastHost />
  </div>
</template>
