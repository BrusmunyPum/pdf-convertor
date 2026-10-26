<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, type ApiError } from '@/services/http';
import type { User } from '@/types';
import { dateTime, khNum } from '@/utils/format';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';

const session = useSession();
const toast = useToast();
const name = ref(session.user?.name ?? '');
const telegram = ref(session.user?.telegram ?? '');
const stats = ref<{ jobs: number; completed: number } | null>(null);
const pw = ref({ currentPassword: '', newPassword: '' });
const saving = ref(false);
const savingPw = ref(false);

onMounted(async () => {
  const r = await api<{ user: User; stats: { jobs: number; completed: number } }>('/me');
  stats.value = r.stats;
});

async function save() {
  saving.value = true;
  try {
    const r = await api<{ user: User }>('/me', { method: 'PATCH', json: { name: name.value, telegram: telegram.value } });
    session.user = r.user;
    toast.success('បានរក្សាទុក');
  } catch (e) {
    toast.error((e as ApiError).message);
  } finally {
    saving.value = false;
  }
}

async function changePw() {
  if (pw.value.newPassword.length < 8) return toast.error('ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងហោចណាស់ ៨ តួអក្សរ');
  savingPw.value = true;
  try {
    await api('/me/password', { method: 'PATCH', json: pw.value });
    pw.value = { currentPassword: '', newPassword: '' };
    toast.success('បានប្ដូរពាក្យសម្ងាត់');
  } catch (e) {
    toast.error((e as ApiError).message);
  } finally {
    savingPw.value = false;
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10">
    <h1 class="mb-6 text-2xl font-semibold text-slate-900">គណនីរបស់ខ្ញុំ</h1>

    <div class="mb-5 grid grid-cols-3 gap-3">
      <div class="card p-4 animate-fade-up">
        <p class="text-xs text-slate-500">ក្រេឌីត</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">{{ khNum(session.credits) }}</p>
      </div>
      <div class="card p-4 animate-fade-up" style="animation-delay: 40ms">
        <p class="text-xs text-slate-500">បានបម្លែង</p>
        <p class="mt-1 text-2xl font-semibold tabular-nums">{{ khNum(stats?.completed ?? 0) }}</p>
      </div>
      <div class="card p-4 animate-fade-up" style="animation-delay: 80ms">
        <p class="text-xs text-slate-500">សមាជិកតាំងពី</p>
        <p class="mt-1 truncate text-sm font-medium">{{ dateTime(session.user?.createdAt) }}</p>
      </div>
    </div>

    <form class="card mb-5 space-y-4 p-6 animate-fade-up" @submit.prevent="save">
      <h2 class="font-semibold text-slate-900">ព័ត៌មានផ្ទាល់ខ្លួន</h2>
      <div>
        <label class="label">អ៊ីមែល</label>
        <input :value="session.user?.email" class="input bg-slate-50 text-slate-500" disabled />
      </div>
      <div>
        <label class="label" for="pname">ឈ្មោះ</label>
        <input id="pname" v-model="name" class="input" minlength="2" maxlength="80" required />
      </div>
      <div>
        <label class="label" for="tg">ឈ្មោះ Telegram (ដើម្បីងាយស្រួលទាក់ទង)</label>
        <input id="tg" v-model="telegram" class="input" placeholder="@username" maxlength="64" />
      </div>
      <div class="flex justify-end"><button class="btn-primary" :disabled="saving">រក្សាទុក</button></div>
    </form>

    <form class="card space-y-4 p-6 animate-fade-up" @submit.prevent="changePw">
      <h2 class="font-semibold text-slate-900">ប្ដូរពាក្យសម្ងាត់</h2>
      <div>
        <label class="label" for="cur">ពាក្យសម្ងាត់បច្ចុប្បន្ន</label>
        <input id="cur" v-model="pw.currentPassword" type="password" class="input" autocomplete="current-password" required />
      </div>
      <div>
        <label class="label" for="new">ពាក្យសម្ងាត់ថ្មី</label>
        <input id="new" v-model="pw.newPassword" type="password" class="input" autocomplete="new-password" minlength="8" required />
      </div>
      <div class="flex justify-end"><button class="btn-secondary" :disabled="savingPw">ប្ដូរពាក្យសម្ងាត់</button></div>
    </form>
  </div>
</template>
