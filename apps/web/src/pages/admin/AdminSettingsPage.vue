<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { api, type ApiError } from '@/services/http';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';

interface Settings {
  guestCredits: number;
  signupCredits: number;
  guestIpDailyCap: number;
  creditCost: number;
  maxFileMb: number;
  maxPages: number;
  maxFilesPerBatch: number;
  guestFileTtlHours: number;
  userFileTtlHours: number;
  telegramUsername: string;
  registrationOpen: boolean;
  announcement: string;
}

const toast = useToast();
const session = useSession();
const s = ref<Settings | null>(null);
const saving = ref(false);

onMounted(async () => (s.value = await api<Settings>('/admin/settings')));

async function save() {
  saving.value = true;
  try {
    s.value = await api<Settings>('/admin/settings', { method: 'PUT', json: s.value });
    session.config = await api('/config');
    toast.success('បានរក្សាទុកការកំណត់');
  } catch (e) {
    toast.error((e as ApiError).message);
  } finally {
    saving.value = false;
  }
}

const numbers: { key: keyof Settings; label: string; hint: string }[] = [
  { key: 'guestCredits', label: 'ក្រេឌីតភ្ញៀវ (មិនចូលគណនី)', hint: 'ចំនួនឯកសារដែលភ្ញៀវអាចបម្លែងបាន' },
  { key: 'guestIpDailyCap', label: 'ដែនកំណត់ភ្ញៀវក្នុងមួយ IP / ថ្ងៃ', hint: 'ការពារការបំពានដោយលុប cookie' },
  { key: 'signupCredits', label: 'ក្រេឌីតពេលចុះឈ្មោះ', hint: 'ផ្ដល់ឲ្យអ្នកប្រើថ្មីម្ដង' },
  { key: 'creditCost', label: 'ក្រេឌីតក្នុងមួយឯកសារ', hint: '' },
  { key: 'maxFileMb', label: 'ទំហំឯកសារអតិបរមា (MB)', hint: 'អតិបរមា ៦០ (nginx)' },
  { key: 'maxPages', label: 'ចំនួនទំព័រអតិបរមា', hint: '' },
  { key: 'maxFilesPerBatch', label: 'ឯកសារច្រើនបំផុតក្នុងមួយលើក', hint: 'ចំនួនឯកសារដែលអាចផ្ទុកឡើងព្រមគ្នា' },
  { key: 'guestFileTtlHours', label: 'រក្សាឯកសារភ្ញៀវ (ម៉ោង)', hint: 'បន្ទាប់មកលុបដោយស្វ័យប្រវត្តិ' },
  { key: 'userFileTtlHours', label: 'រក្សាឯកសារអ្នកប្រើ (ម៉ោង)', hint: '១៦៨ = ៧ ថ្ងៃ' },
];
</script>

<template>
  <div>
    <div v-if="!s" class="h-64 animate-pulse rounded-2xl bg-white" />
    <form v-else class="space-y-5" @submit.prevent="save">
      <div class="card p-6">
        <h2 class="mb-4 font-semibold text-slate-900">ក្រេឌីត និងដែនកំណត់</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <div v-for="n in numbers" :key="n.key">
            <label class="label" :for="n.key">{{ n.label }}</label>
            <input :id="n.key" v-model.number="(s as any)[n.key]" type="number" min="0" class="input" />
            <p v-if="n.hint" class="mt-1 text-xs text-slate-500">{{ n.hint }}</p>
          </div>
        </div>
      </div>

      <div class="card space-y-4 p-6">
        <h2 class="font-semibold text-slate-900">ទូទៅ</h2>
        <div>
          <label class="label" for="tgu">ឈ្មោះ Telegram របស់អ្នកគ្រប់គ្រង</label>
          <input id="tgu" v-model="s.telegramUsername" class="input" placeholder="username (គ្មាន @)" />
          <p class="mt-1 text-xs text-slate-500">អ្នកប្រើនឹងត្រូវបានបញ្ជូនទៅ t.me/{{ s.telegramUsername || '…' }} ដើម្បីស្នើសុំក្រេឌីត</p>
        </div>
        <div>
          <label class="label" for="ann">សេចក្ដីជូនដំណឹងនៅទំព័រដើម</label>
          <textarea id="ann" v-model="s.announcement" rows="2" maxlength="500" class="input" placeholder="ទុកទទេ ដើម្បីលាក់" />
        </div>
        <label class="flex cursor-pointer items-center gap-3">
          <input v-model="s.registrationOpen" type="checkbox" class="peer sr-only" />
          <span class="relative h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-brand-600 after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition peer-checked:after:translate-x-5" />
          <span class="text-sm text-slate-700">បើកការចុះឈ្មោះអ្នកប្រើថ្មី</span>
        </label>
      </div>

      <div class="flex justify-end">
        <button class="btn-primary px-6" :disabled="saving">រក្សាទុក</button>
      </div>
    </form>
  </div>
</template>
