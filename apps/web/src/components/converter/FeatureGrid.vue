<script setup lang="ts">
import { mdiFormatFont, mdiShieldCheckOutline, mdiTextRecognition, mdiTranslate } from '@mdi/js';
import Icon from '@/components/ui/Icon.vue';

const features = [
  { icon: mdiTranslate, title: 'ជួសជុលអក្សរខ្មែរ', text: 'កែស្រៈ និងជើងអក្សរដែលខូចពេលទាញចេញពី PDF ឲ្យត្រឹមត្រូវតាម Unicode' },
  { icon: mdiFormatFont, title: 'រក្សាពុម្ពអក្សរ', text: 'Khmer OS, Battambang, Siemreap, Moul… ត្រូវបានរក្សា និងបង្កប់ក្នុងឯកសារ Word' },
  { icon: mdiTextRecognition, title: 'OCR សម្រាប់ឯកសារស្កេន', text: 'ស្គាល់អក្សរខ្មែរ និងអង់គ្លេសពីរូបភាព ឲ្យអាចកែសម្រួលបាន' },
  { icon: mdiShieldCheckOutline, title: 'សុវត្ថិភាព', text: 'ឯកសាររបស់អ្នកត្រូវលុបចោលដោយស្វ័យប្រវត្តិ បន្ទាប់ពីផុតកំណត់' },
];
</script>

<template>
  <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <div
      v-for="(f, i) in features"
      :key="f.title"
      class="rounded-2xl border border-slate-200 bg-white p-5 animate-fade-up"
      :style="{ animationDelay: `${120 + i * 60}ms` }"
    >
      <span class="mb-3 grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><Icon :path="f.icon" :size="22" /></span>
      <p class="font-medium text-slate-900">{{ f.title }}</p>
      <p class="mt-1 text-sm text-slate-500">{{ f.text }}</p>
    </div>
  </section>
</template>
