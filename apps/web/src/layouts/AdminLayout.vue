<script setup lang="ts">
import {
  mdiAccountCircleOutline,
  mdiAccountGroupOutline,
  mdiBellOutline,
  mdiClose,
  mdiCogOutline,
  mdiFileSwapOutline,
  mdiHomeOutline,
  mdiLogout,
  mdiMenu,
  mdiStarFourPointsOutline,
  mdiViewDashboardOutline,
} from '@mdi/js';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import Icon from '@/components/ui/Icon.vue';
import { connected } from '@/services/realtime';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';
import { khNum } from '@/utils/format';

const session = useSession();
const toast = useToast();
const route = useRoute();
const router = useRouter();

const links = [
  { to: '/admin', label: 'ផ្ទាំងសង្ខេប', icon: mdiViewDashboardOutline, exact: true },
  { to: '/admin/requests', label: 'សំណើក្រេឌីត', icon: mdiStarFourPointsOutline, badge: true },
  { to: '/admin/users', label: 'អ្នកប្រើប្រាស់', icon: mdiAccountGroupOutline },
  { to: '/admin/conversions', label: 'ការបម្លែង', icon: mdiFileSwapOutline },
  { to: '/admin/settings', label: 'ការកំណត់', icon: mdiCogOutline },
];

const isActive = (l: (typeof links)[number]) => (l.exact ? route.path === l.to : route.path.startsWith(l.to));
const title = computed(() => (route.meta.title as string | undefined) ?? 'ផ្ទាំងគ្រប់គ្រង');

/** phone: the sidebar is an off-canvas drawer */
const drawerOpen = ref(false);
const menuOpen = ref(false);
const menuRef = ref<HTMLElement | null>(null);

watch(() => route.fullPath, () => {
  drawerOpen.value = false;
  menuOpen.value = false;
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
</script>

<template>
  <div class="flex h-dvh overflow-hidden bg-slate-50">
    <Transition name="fade">
      <div v-if="drawerOpen" class="fixed inset-0 z-40 bg-slate-900/55 md:hidden" @click="drawerOpen = false" />
    </Transition>

    <!-- Sidebar: a slide-in drawer on phones, fixed from md up -->
    <aside
      class="fixed inset-y-0 left-0 z-50 flex w-[min(17rem,86vw)] shrink-0 flex-col bg-brand-700 text-white transition-transform duration-300 ease-out md:static md:w-64 md:translate-x-0"
      :class="drawerOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'"
    >
      <div class="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5">
        <RouterLink to="/admin" class="flex min-w-0 items-center gap-3">
          <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white p-1">
            <img src="/assets/logo-mark-transparent.png" alt="" class="h-full w-full object-contain" />
          </span>
          <span class="truncate text-[1.1rem] font-semibold tracking-wider">DIGITECHKH</span>
        </RouterLink>
        <button class="grid h-8 w-8 place-items-center rounded-lg text-white/80 hover:bg-white/10 hover:text-white md:hidden" aria-label="បិទម៉ឺនុយ" @click="drawerOpen = false">
          <Icon :path="mdiClose" :size="18" />
        </button>
      </div>

      <p class="px-6 pb-1 pt-4 text-[11px] font-semibold tracking-wide text-white/50">ផ្ទាំងគ្រប់គ្រង</p>
      <nav class="flex-1 space-y-1 overflow-y-auto px-3 py-1 text-[15px]" aria-label="ម៉ឺនុយគ្រប់គ្រង">
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors"
          :class="isActive(l) ? 'bg-brand-600 font-semibold text-white shadow-sm ring-1 ring-white/10' : 'text-white/80 hover:bg-white/10 hover:text-white'"
          :aria-current="isActive(l) ? 'page' : undefined"
        >
          <Icon :path="l.icon" :size="20" :class="isActive(l) ? '' : 'opacity-80'" />
          <span class="truncate">{{ l.label }}</span>
          <span
            v-if="l.badge && session.pendingRequests"
            class="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1.5 text-[11px] font-bold text-amber-950 animate-pop"
          >{{ khNum(session.pendingRequests) }}</span>
        </RouterLink>
      </nav>

      <div class="shrink-0 space-y-1 border-t border-white/10 p-3 text-[15px]">
        <RouterLink to="/" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-white/80 transition-colors hover:bg-white/10 hover:text-white">
          <Icon :path="mdiHomeOutline" :size="20" class="opacity-80" /> ត្រឡប់ទៅគេហទំព័រ
        </RouterLink>
        <button class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-white/80 transition-colors hover:bg-white/10 hover:text-white" @click="logout">
          <Icon :path="mdiLogout" :size="20" class="opacity-80" /> ចាកចេញ
        </button>
      </div>
    </aside>

    <div class="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
      <header class="z-10 flex h-14 w-full shrink-0 items-center justify-between gap-2 border-b border-slate-200/70 bg-white px-3 md:px-6">
        <div class="flex min-w-0 items-center gap-2">
          <button class="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-slate-600 hover:bg-slate-100 md:hidden" aria-label="ម៉ឺនុយ" @click="drawerOpen = true">
            <Icon :path="mdiMenu" />
          </button>
          <h2 class="truncate text-base font-semibold leading-tight text-slate-800 md:text-xl">{{ title }}</h2>
        </div>

        <div class="flex shrink-0 items-center gap-1 md:gap-3">
          <!-- live connection: new conversions and requests show up on their own -->
          <span
            class="hidden items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-medium sm:inline-flex"
            :class="connected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'"
            :title="connected ? 'ទិន្នន័យថ្មីលេចឡើងដោយស្វ័យប្រវត្តិ' : 'មិនទាន់តភ្ជាប់ការធ្វើបច្ចុប្បន្នភាព'"
          >
            <span class="h-1.5 w-1.5 rounded-full" :class="connected ? 'animate-pulse bg-emerald-500' : 'bg-slate-300'" />
            {{ connected ? 'បច្ចុប្បន្នភាព' : 'ក្រៅបណ្តាញ' }}
          </span>

          <RouterLink to="/admin/requests" class="relative rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700" title="សំណើក្រេឌីតរង់ចាំ">
            <Icon :path="mdiBellOutline" :size="22" />
            <span
              v-if="session.pendingRequests"
              class="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white ring-2 ring-white"
            >{{ session.pendingRequests > 99 ? '99+' : khNum(session.pendingRequests) }}</span>
          </RouterLink>

          <div v-if="session.user" ref="menuRef" class="relative flex items-center border-slate-200 pl-1 md:border-l md:pl-4">
            <button class="relative flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-brand-600/20" @click.stop="menuOpen = !menuOpen">
              <span class="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                {{ session.user.name.slice(0, 1).toUpperCase() }}
              </span>
              <span class="absolute bottom-0 left-7 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
              <span class="hidden max-w-[140px] text-left leading-tight lg:block">
                <span class="block truncate text-sm font-medium text-slate-700">{{ session.user.name }}</span>
                <span class="block text-[11px] text-slate-400">អ្នកគ្រប់គ្រង</span>
              </span>
            </button>
            <Transition name="fade">
              <div v-if="menuOpen" class="absolute right-0 top-full mt-2.5 w-60 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-xl">
                <div class="border-b border-slate-100 px-4 py-2.5">
                  <p class="truncate text-sm font-medium">{{ session.user.name }}</p>
                  <p class="truncate text-xs text-slate-500">{{ session.user.email }}</p>
                </div>
                <RouterLink to="/profile" class="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50">
                  <Icon :path="mdiAccountCircleOutline" :size="18" class="text-slate-400" /> គណនីរបស់ខ្ញុំ
                </RouterLink>
                <RouterLink to="/" class="flex items-center gap-2.5 px-4 py-2 text-sm hover:bg-slate-50">
                  <Icon :path="mdiHomeOutline" :size="18" class="text-slate-400" /> គេហទំព័រ
                </RouterLink>
                <button class="flex w-full items-center gap-2.5 border-t border-slate-100 px-4 py-2 text-sm text-red-600 hover:bg-red-50" @click="logout">
                  <Icon :path="mdiLogout" :size="18" /> ចាកចេញ
                </button>
              </div>
            </Transition>
          </div>
        </div>
      </header>

      <main class="w-full flex-1 overflow-y-auto overflow-x-hidden px-4 py-5 md:px-6">
        <div class="mx-auto max-w-7xl">
          <RouterView v-slot="{ Component }">
            <Transition name="page" mode="out-in"><component :is="Component" /></Transition>
          </RouterView>
        </div>
      </main>
    </div>
  </div>
</template>
