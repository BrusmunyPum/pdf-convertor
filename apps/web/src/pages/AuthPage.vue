<script setup lang="ts">
import {
  mdiAccountOutline,
  mdiAlertCircle,
  mdiArrowRight,
  mdiEmailOutline,
  mdiEyeOffOutline,
  mdiEyeOutline,
  mdiLockOutline,
  mdiStarFourPointsOutline,
} from '@mdi/js';
import { computed, ref, watch } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';
import Icon from '@/components/ui/Icon.vue';
import type { ApiError } from '@/services/http';
import { khNum } from '@/utils/format';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';

const route = useRoute();
const router = useRouter();
const session = useSession();
const toast = useToast();

const isRegister = computed(() => route.name === 'register');
const name = ref('');
const email = ref('');
const password = ref('');
const showPw = ref(false);
const loading = ref(false);
const error = ref('');
/** "Forgot password?" explains who can set a new one: there is no self-service reset. */
const showForgotHelp = ref(false);

watch(isRegister, () => {
  error.value = '';
  showForgotHelp.value = false;
});

async function submit() {
  error.value = '';
  if (isRegister.value && password.value.length < 8) {
    error.value = 'ពាក្យសម្ងាត់ត្រូវមានយ៉ាងហោចណាស់ ៨ តួអក្សរ';
    return;
  }
  loading.value = true;
  try {
    if (isRegister.value) {
      await session.register(name.value, email.value, password.value);
      toast.success(`សូមស្វាគមន៍! អ្នកទទួលបាន ${khNum(session.credits)} ក្រេឌីត`);
    } else {
      await session.login(email.value, password.value);
      toast.success('ចូលគណនីបានជោគជ័យ');
    }
    const next = typeof route.query.next === 'string' && route.query.next.startsWith('/') ? route.query.next : '/';
    router.push(next);
  } catch (e) {
    error.value = (e as ApiError).message;
  } finally {
    loading.value = false;
  }
}

const fieldClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition ' +
  'placeholder:text-xs placeholder:font-normal placeholder:text-slate-400 hover:border-slate-300 hover:bg-slate-100/70 ' +
  'focus:border-brand-600 focus:bg-white focus:ring-4 focus:ring-brand-600/10';
</script>

<template>
  <div class="login-bg flex min-h-dvh items-start justify-center p-4 sm:items-center md:p-8">
    <main class="my-auto flex w-full max-w-4xl items-center justify-center">
      <div class="grid w-full grid-cols-1 overflow-hidden rounded-3xl border border-white/20 bg-white shadow-2xl md:grid-cols-2">
        <!-- Left: city skyline with the brand story -->
        <div class="group relative hidden h-56 shrink-0 overflow-hidden bg-slate-900 sm:block md:h-auto md:min-h-[460px]">
          <img
            src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?auto=format&fit=crop&w=1200&q=80"
            alt=""
            class="h-full w-full scale-105 object-cover object-center transition-transform duration-700 ease-out group-hover:scale-110"
          />
          <div class="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/85 via-black/40 to-black/20 p-5 text-white sm:p-6 md:p-8">
            <div class="mb-2.5 flex h-10 w-10 items-center justify-center sm:mb-3 sm:h-12 sm:w-12 md:mb-4 md:h-14 md:w-14">
              <img src="/assets/logo-mark-transparent.png" alt="DIGITECHKH" class="h-full w-full object-contain" />
            </div>
            <div class="mb-2 inline-flex w-fit items-center gap-2 rounded-xl border border-white/20 bg-white/15 px-2.5 py-0.5 backdrop-blur-md sm:mb-2.5 sm:px-3 sm:py-1">
              <span class="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              <span class="text-xs font-medium text-white">ប្រព័ន្ធសុវត្ថិភាពខ្ពស់</span>
            </div>
            <h3 class="mb-1 text-lg font-bold tracking-tight text-white sm:mb-1.5 sm:text-xl">ប្រព័ន្ធបម្លែងឯកសារ PDF</h3>
            <p class="hidden text-xs font-light leading-relaxed text-white/80 sm:block">
              បម្លែងឯកសារ PDF ខ្មែរ ទៅជា Word, PowerPoint, Excel និង CSV ដោយរក្សាពុម្ពអក្សរ និងទម្រង់ដូចដើម
            </p>
          </div>
        </div>

        <!-- Right: the form -->
        <div class="flex flex-col justify-between bg-white p-6 sm:p-8 md:p-10">
          <!-- Desktop header with the Cambodia flag -->
          <div class="hidden items-center justify-between pb-1 md:flex">
            <RouterLink to="/" class="flex items-center gap-2.5">
              <img src="/assets/logo-mark-transparent.png" alt="DIGITECHKH" class="h-8 w-8 object-contain" />
              <span class="text-sm font-bold tracking-wider text-brand-600">DIGITECHKH</span>
            </RouterLink>
            <img
              src="/assets/flag-kh.png"
              alt="ភាសាខ្មែរ"
              title="ភាសាខ្មែរ"
              width="32"
              height="18"
              class="h-[18px] w-8 rounded-[3px] border border-slate-200 object-cover shadow-2xs"
            />
          </div>

          <!-- Phone brand block (the hero photo is hidden below sm) -->
          <RouterLink to="/" class="flex flex-col items-center gap-2 pt-2 sm:hidden">
            <img src="/assets/logo-mark-transparent.png" alt="DIGITECHKH" class="h-14 w-14 object-contain" />
            <span class="text-sm font-bold tracking-[0.2em] text-brand-600">DIGITECHKH</span>
          </RouterLink>

          <div class="my-3 text-center sm:my-5">
            <h2 class="text-xl font-bold tracking-tight text-slate-800 sm:text-2xl">
              {{ isRegister ? 'បង្កើតគណនីថ្មី' : 'ចូលគណនីរបស់អ្នក' }}
            </h2>
            <p class="mt-1.5 text-xs font-normal text-slate-500 sm:text-sm">
              {{ isRegister ? 'ចុះឈ្មោះដើម្បីទទួលបានក្រេឌីត និងរក្សាប្រវត្តិការបម្លែង' : 'សូមបញ្ចូលអ៊ីមែល និងពាក្យសម្ងាត់ដើម្បីបន្ត' }}
            </p>
          </div>

          <div
            v-if="isRegister && session.config?.signupCredits"
            class="mb-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3.5 py-2.5 text-xs text-amber-800"
          >
            <Icon :path="mdiStarFourPointsOutline" :size="16" class="text-amber-500" />
            ទទួលបាន {{ khNum(session.config.signupCredits) }} ក្រេឌីតឥតគិតថ្លៃ ពេលចុះឈ្មោះ
          </div>

          <div
            v-if="error"
            :key="error"
            class="animate-shake mb-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700"
          >
            <Icon :path="mdiAlertCircle" :size="16" class="text-rose-500" />
            <span>{{ error }}</span>
          </div>

          <form class="space-y-4" @submit.prevent="submit">
            <div v-if="isRegister">
              <label for="name" class="mb-1.5 block text-xs font-semibold text-slate-700">ឈ្មោះ <span class="text-rose-500">*</span></label>
              <div class="relative">
                <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Icon :path="mdiAccountOutline" :size="18" />
                </span>
                <input
                  id="name"
                  v-model="name"
                  :class="fieldClass"
                  required
                  minlength="2"
                  maxlength="80"
                  autocomplete="name"
                  placeholder="បញ្ចូលឈ្មោះរបស់អ្នក"
                />
              </div>
            </div>

            <div>
              <label for="email" class="mb-1.5 block text-xs font-semibold text-slate-700">អ៊ីមែល <span class="text-rose-500">*</span></label>
              <div class="relative">
                <span class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <Icon :path="mdiEmailOutline" :size="18" />
                </span>
                <input
                  id="email"
                  v-model="email"
                  type="email"
                  :class="fieldClass"
                  required
                  :autocomplete="isRegister ? 'email' : 'username'"
                  placeholder="បញ្ចូលអ៊ីមែល"
                />
              </div>
            </div>

            <div>
              <label for="password" class="mb-1.5 block text-xs font-semibold text-slate-700">ពាក្យសម្ងាត់ <span class="text-rose-500">*</span></label>
              <div class="relative w-full">
                <span class="pointer-events-none absolute inset-y-0 left-0 z-10 flex items-center pl-3.5 text-slate-400">
                  <Icon :path="mdiLockOutline" :size="18" />
                </span>
                <input
                  id="password"
                  v-model="password"
                  :type="showPw ? 'text' : 'password'"
                  :class="[fieldClass, 'tracking-wider sm:!pr-11']"
                  required
                  :autocomplete="isRegister ? 'new-password' : 'current-password'"
                  placeholder="បញ្ចូលពាក្យសម្ងាត់"
                />
                <button
                  type="button"
                  class="absolute inset-y-0 right-0 z-20 flex w-12 items-center justify-center text-slate-400 transition-colors hover:text-slate-700"
                  :aria-label="showPw ? 'លាក់ពាក្យសម្ងាត់' : 'បង្ហាញពាក្យសម្ងាត់'"
                  @click="showPw = !showPw"
                >
                  <Icon :path="showPw ? mdiEyeOffOutline : mdiEyeOutline" :size="18" :class="showPw ? 'text-brand-600' : ''" />
                </button>
              </div>
              <p v-if="isRegister" class="mt-1 text-xs text-slate-500">យ៉ាងហោចណាស់ ៨ តួអក្សរ</p>
            </div>

            <div v-if="!isRegister" class="pt-0.5">
              <div class="flex justify-end">
                <button
                  type="button"
                  class="text-xs font-medium text-brand-600 transition-colors hover:text-brand-700"
                  :aria-expanded="showForgotHelp"
                  aria-controls="forgot-help"
                  @click="showForgotHelp = !showForgotHelp"
                >
                  ភ្លេចពាក្យសម្ងាត់?
                </button>
              </div>
              <p
                v-if="showForgotHelp"
                id="forgot-help"
                role="note"
                class="mt-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-xs leading-relaxed text-brand-700"
              >
                សូមទាក់ទងក្រុមការងារ DIGITECHKH ដើម្បីកំណត់ពាក្យសម្ងាត់ថ្មី<template v-if="session.config?.telegramUsername">
                  តាម <a :href="`https://t.me/${session.config.telegramUsername}`" target="_blank" rel="noopener" class="font-semibold underline">Telegram</a></template>។
              </p>
            </div>

            <div class="pt-2">
              <button
                type="submit"
                :disabled="loading"
                class="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-medium text-white shadow-md transition-all duration-200 hover:bg-brand-700 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70"
              >
                <template v-if="loading">
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  <span>កំពុងផ្ទៀងផ្ទាត់...</span>
                </template>
                <template v-else>
                  <span>{{ isRegister ? 'ចុះឈ្មោះ' : 'ចូលប្រព័ន្ធ' }}</span>
                  <Icon :path="mdiArrowRight" :size="16" />
                </template>
              </button>
            </div>
          </form>

          <p class="mt-5 text-center text-xs text-slate-500">
            <template v-if="isRegister">មានគណនីរួចហើយ? <RouterLink to="/login" class="font-medium text-brand-600 hover:text-brand-700">ចូលគណនី</RouterLink></template>
            <template v-else>មិនទាន់មានគណនី? <RouterLink to="/register" class="font-medium text-brand-600 hover:text-brand-700">ចុះឈ្មោះ</RouterLink></template>
          </p>

          <div class="mt-4 border-t border-slate-100 pt-3 text-center">
            <p class="text-[11px] font-light text-slate-400">រក្សាសិទ្ធិគ្រប់យ៉ាង © {{ new Date().getFullYear() }} DIGITECHKH</p>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.login-bg {
  background: linear-gradient(
    to bottom right,
    var(--color-brand-700),
    var(--color-brand-600),
    color-mix(in srgb, var(--color-brand-700) 75%, black)
  );
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20%, 60% { transform: translateX(-5px); }
  40%, 80% { transform: translateX(5px); }
}

.animate-shake {
  animation: shake 0.4s ease-in-out;
}
</style>
