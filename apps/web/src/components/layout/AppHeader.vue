<script setup lang="ts">
import {
  mdiAccountCircleOutline,
  mdiCogOutline,
  mdiFileSwapOutline,
  mdiHistory,
  mdiLogout,
  mdiMenu,
  mdiShieldCrownOutline,
  mdiStarFourPointsOutline,
} from '@mdi/js';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import Icon from '@/components/ui/Icon.vue';
import { khNum } from '@/utils/format';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';

const session = useSession();
const toast = useToast();
const router = useRouter();
const route = useRoute();
const menuOpen = ref(false);
const mobileOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

watch(() => route.fullPath, () => {
  menuOpen.value = false;
  mobileOpen.value = false;
});

function onDocClick(e: MouseEvent) {
  if (menuRef.value && !menuRef.value.contains(e.target as Node)) menuOpen.value = false;
}
onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));

async function logout() {
  await session.logout();
  toast.info('បានចាកចេញពីគណនី');
  router.push('/');
}

const nav = [
  { to: '/', label: 'បម្លែង', icon: mdiFileSwapOutline },
  { to: '/history', label: 'ប្រវត្តិ', icon: mdiHistory },
];
</script>

<template>
<header class="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur">
  <div class="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
    <RouterLink to="/" class="flex items-center gap-2.5">
      <img src="/assets/logo-mark-transparent.png" alt="" class="h-8 w-8 object-contain" />
      <span class="text-lg font-bold tracking-wider text-brand-600">DIGITECHKH</span>
    </RouterLink>

    <nav class="ml-4 hidden items-center gap-1 md:flex">
      <RouterLink
        v-for="n in nav"
        :key="n.to"
        :to="n.to"
        class="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        exact-active-class="!bg-brand-50 !text-brand-700"
      >
        {{ n.label }}
      </RouterLink>
      <RouterLink
        v-if="session.isAdmin"
        to="/admin"
        class="rounded-lg px-3 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        active-class="!bg-brand-50 !text-brand-700"
      >
        គ្រប់គ្រង
        <span v-if="session.pendingRequests" class="ml-1 inline-grid h-5 min-w-5 place-items-center rounded-full bg-amber-500 px-1 text-[11px] font-semibold text-white animate-pop">{{ khNum(session.pendingRequests) }}</span>
      </RouterLink>
    </nav>

    <div class="ml-auto flex items-center gap-2">
      <RouterLink
        :to="session.user ? '/credits' : '/register'"
        class="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-700 transition hover:border-brand-300 sm:flex"
        :title="session.user ? 'ក្រេឌីតរបស់អ្នក' : 'ក្រេឌីតឥតគិតថ្លៃ'"
      >
        <Icon :path="mdiStarFourPointsOutline" :size="16" class="text-amber-500" />
        <span class="font-semibold tabular-nums">{{ khNum(session.credits) }}</span>
        <span class="text-slate-500">ក្រេឌីត</span>
      </RouterLink>

      <template v-if="session.ready && !session.user">
        <RouterLink to="/login" class="btn-ghost btn-sm hidden sm:inline-flex">ចូលគណនី</RouterLink>
        <RouterLink to="/register" class="btn-primary btn-sm">ចុះឈ្មោះ</RouterLink>
      </template>

      <div v-else-if="session.user" ref="menuRef" class="relative">
        <button
          class="flex items-center gap-2 rounded-full py-1 pl-1 pr-3 text-sm transition hover:bg-slate-100"
          @click.stop="menuOpen = !menuOpen"
        >
          <span class="grid h-8 w-8 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
            {{ session.user.name.slice(0, 1).toUpperCase() }}
          </span>
          <span class="hidden max-w-[120px] truncate text-slate-700 sm:block">{{ session.user.name }}</span>
        </button>
        <Transition name="fade">
          <div v-if="menuOpen" class="absolute right-0 mt-2 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
            <div class="border-b border-slate-100 px-4 py-2.5">
              <p class="truncate text-sm font-medium">{{ session.user.name }}</p>
              <p class="truncate text-xs text-slate-500">{{ session.user.email }}</p>
            </div>
            <RouterLink to="/credits" class="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50">
              <Icon :path="mdiStarFourPointsOutline" :size="18" class="text-slate-400" /> ក្រេឌីត
            </RouterLink>
            <RouterLink to="/profile" class="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50">
              <Icon :path="mdiAccountCircleOutline" :size="18" class="text-slate-400" /> គណនីរបស់ខ្ញុំ
            </RouterLink>
            <RouterLink v-if="session.isAdmin" to="/admin" class="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50">
              <Icon :path="mdiShieldCrownOutline" :size="18" class="text-slate-400" /> ផ្ទាំងគ្រប់គ្រង
            </RouterLink>
            <button class="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50" @click="logout">
              <Icon :path="mdiLogout" :size="18" /> ចាកចេញ
            </button>
          </div>
        </Transition>
      </div>

      <button class="btn-ghost btn-sm !px-2 md:hidden" aria-label="ម៉ឺនុយ" @click="mobileOpen = !mobileOpen">
        <Icon :path="mdiMenu" />
      </button>
    </div>
  </div>

  <Transition name="fade">
    <nav v-if="mobileOpen" class="border-t border-slate-100 px-4 py-2 md:hidden">
      <RouterLink v-for="n in nav" :key="n.to" :to="n.to" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50">
        <Icon :path="n.icon" :size="18" class="text-slate-400" /> {{ n.label }}
      </RouterLink>
      <RouterLink v-if="session.user" to="/credits" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50">
        <Icon :path="mdiStarFourPointsOutline" :size="18" class="text-slate-400" /> ក្រេឌីត ({{ khNum(session.credits) }})
      </RouterLink>
      <RouterLink v-if="session.isAdmin" to="/admin" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50">
        <Icon :path="mdiCogOutline" :size="18" class="text-slate-400" /> គ្រប់គ្រង
      </RouterLink>
      <RouterLink v-if="!session.user" to="/login" class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm hover:bg-slate-50">
        <Icon :path="mdiAccountCircleOutline" :size="18" class="text-slate-400" /> ចូលគណនី
      </RouterLink>
    </nav>
  </Transition>
</header>
</template>
