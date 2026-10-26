<script setup lang="ts">
import { mdiFolderZipOutline, mdiHistory, mdiStarFourPointsOutline } from '@mdi/js';
import { computed, reactive, ref } from 'vue';
import { RouterLink } from 'vue-router';
import ConvertOptions from '@/components/converter/ConvertOptions.vue';
import DropZone from '@/components/converter/DropZone.vue';
import FeatureGrid from '@/components/converter/FeatureGrid.vue';
import FormatPicker from '@/components/converter/FormatPicker.vue';
import QueueItem from '@/components/converter/QueueItem.vue';
import Icon from '@/components/ui/Icon.vue';
import { conversionsApi } from '@/api/conversions';
import { useUploadQueue } from '@/composables/useUploadQueue';
import { FORMATS } from '@/constants/formats';
import { useSession } from '@/stores/session';
import { useToast } from '@/stores/toast';
import type { ConvertOptions as Options, Format } from '@/types';
import { khNum } from '@/utils/format';

const session = useSession();
const toast = useToast();
const queue = useUploadQueue();

const target = ref<Format>('docx');
const options = reactive<Options>({ mode: 'flow', ocr: 'auto', password: '' });
const showOptions = ref(false);

const cost = computed(() => session.config?.creditCost ?? 1);
const pending = computed(() => queue.items.filter((i) => queue.needsWork(i, target.value)).length);
const isRepeat = computed(() => queue.items.some((i) => queue.needsWork(i, target.value) && queue.jobOf(i)?.status === 'COMPLETED'));
const canAfford = computed(() => session.credits >= cost.value);
const allDone = computed(() => queue.items.length > 0 && pending.value === 0 && !queue.busy.value);

const actionLabel = computed(() => {
  const f = FORMATS[target.value].label;
  const n = pending.value;
  if (isRepeat.value) return n > 1 ? `បម្លែង ${khNum(n)} ឯកសារម្ដងទៀតទៅជា ${f}` : `បម្លែងម្ដងទៀតទៅជា ${f}`;
  return n > 1 ? `បម្លែង ${khNum(n)} ឯកសារទៅជា ${f}` : `បម្លែងទៅជា ${f}`;
});

function onFiles(files: FileList) {
  const problems = queue.addFiles(files);
  problems.forEach((p) => toast.error(p));
}

async function convert() {
  const { started, skipped } = await queue.start(target.value, { ...options });
  if (skipped > 0) {
    toast.error(
      session.isGuest
        ? `ក្រេឌីតមិនគ្រប់ — បានបម្លែងតែ ${khNum(started)} ឯកសារ។ ចុះឈ្មោះដើម្បីទទួលបានក្រេឌីតបន្ថែម`
        : `ក្រេឌីតមិនគ្រប់ — បានបម្លែងតែ ${khNum(started)} ឯកសារ។ សូមស្នើសុំក្រេឌីតបន្ថែម`,
    );
  }
  if (queue.items.some((i) => i.errorCode === 'PASSWORD_REQUIRED')) showOptions.value = true;
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 pb-16 pt-10 sm:pt-14">
    <section class="mb-8 text-center animate-fade-up">
      <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-4xl">បម្លែង PDF ខ្មែរ ឲ្យដូចដើម</h1>
      <p class="mx-auto mt-3 max-w-2xl text-slate-500 sm:text-lg">
        ទៅជា Word, PowerPoint, Excel, CSV និងច្រើនទៀត — រក្សាពុម្ពអក្សរ ប្លង់ និងទំព័រ ដូចឯកសារដើម
      </p>
      <p v-if="session.config?.announcement" class="mx-auto mt-4 max-w-2xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
        {{ session.config.announcement }}
      </p>
    </section>

    <div class="card overflow-hidden shadow-sm animate-fade-up" style="animation-delay: 60ms">
      <div class="border-b border-slate-100 p-5 sm:p-6">
        <p class="mb-3 text-sm font-medium text-slate-700">១. ជ្រើសរើសទម្រង់ដែលចង់បាន</p>
        <FormatPicker v-model="target" :disabled="queue.running.value" />
      </div>

      <div class="p-5 sm:p-6">
        <div class="mb-3 flex items-center justify-between">
          <p class="text-sm font-medium text-slate-700">
            ២. ជ្រើសរើសឯកសារ PDF
            <span v-if="queue.items.length" class="ml-1 text-slate-400">({{ khNum(queue.items.length) }})</span>
          </p>
          <button v-if="queue.items.length && !queue.busy.value" type="button" class="text-sm text-slate-500 hover:text-red-600" @click="queue.clearFinished()">
            ជម្រះបញ្ជី
          </button>
        </div>

        <TransitionGroup v-if="queue.items.length" name="list" tag="ul" class="mb-3 space-y-2">
          <QueueItem
            v-for="item in queue.items"
            :key="item.key"
            :item="item"
            :job="queue.jobOf(item)"
            :status="queue.statusOf(item)"
            @remove="queue.remove(item)"
          />
        </TransitionGroup>

        <DropZone
          :compact="queue.items.length > 0"
          :max-mb="session.config?.maxFileMb ?? 50"
          :max-pages="session.config?.maxPages ?? 300"
          :max-files="session.config?.maxFilesPerBatch ?? 10"
          @files="onFiles"
        />

        <div v-if="queue.items.length" class="mt-4">
          <ConvertOptions v-model="options" v-model:open="showOptions" :target="target" />
        </div>

        <!-- the one action area -->
        <div v-if="queue.items.length" class="mt-5 flex flex-col-reverse items-stretch gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p class="flex items-center gap-1.5 text-sm text-slate-500">
            <Icon :path="mdiStarFourPointsOutline" :size="16" class="text-amber-500" />
            <template v-if="pending">ប្រើ {{ khNum(pending * cost) }} ក្រេឌីត · </template>នៅសល់ {{ khNum(session.credits) }}
          </p>
          <div class="flex flex-col gap-2 sm:flex-row">
            <a
              v-if="queue.doneJobIds.value.length > 1"
              :href="conversionsApi.archiveUrl(queue.doneJobIds.value)"
              class="btn"
              :class="allDone ? 'btn-primary px-6 py-3 text-base' : 'btn-secondary'"
            >
              <Icon :path="mdiFolderZipOutline" :size="18" /> ទាញយកទាំងអស់ (ZIP)
            </a>
            <button
              v-if="pending > 0 || queue.busy.value"
              type="button"
              class="btn-primary px-6 py-3 text-base"
              :disabled="queue.running.value || !pending || !canAfford"
              @click="convert"
            >
              <span v-if="queue.running.value" class="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              {{ queue.running.value ? 'កំពុងផ្ទុកឡើង…' : pending ? actionLabel : 'កំពុងបម្លែង…' }}
            </button>
            <RouterLink v-else-if="allDone && queue.doneJobIds.value.length <= 1" to="/history" class="btn-secondary">
              <Icon :path="mdiHistory" :size="18" /> មើលប្រវត្តិ
            </RouterLink>
          </div>
        </div>

        <div v-if="!canAfford && pending > 0" class="mt-5 rounded-xl border border-brand-100 bg-brand-50/60 p-4 text-sm animate-fade-up">
          <template v-if="session.isGuest">
            <p class="font-medium text-brand-900">ក្រេឌីតឥតគិតថ្លៃរបស់អ្នកបានប្រើអស់ហើយ</p>
            <p class="mt-1 text-brand-800/80">ចុះឈ្មោះដើម្បីទទួលបាន {{ khNum(session.config?.signupCredits ?? 0) }} ក្រេឌីតបន្ថែម និងរក្សាប្រវត្តិការបម្លែងរបស់អ្នក។</p>
            <RouterLink to="/register" class="btn-primary btn-sm mt-3">ចុះឈ្មោះឥតគិតថ្លៃ</RouterLink>
          </template>
          <template v-else>
            <p class="font-medium text-brand-900">ក្រេឌីតរបស់អ្នកអស់ហើយ</p>
            <p class="mt-1 text-brand-800/80">ស្នើសុំក្រេឌីតបន្ថែមពីអ្នកគ្រប់គ្រងតាម Telegram — មិនចាំបាច់បង់ប្រាក់អនឡាញ។</p>
            <RouterLink to="/credits" class="btn-primary btn-sm mt-3">ស្នើសុំក្រេឌីត</RouterLink>
          </template>
        </div>
      </div>
    </div>

    <p v-if="session.isGuest && canAfford" class="mt-4 text-center text-sm text-slate-500">
      អ្នកអាចបម្លែងបាន {{ khNum(session.credits) }} ឯកសារដោយមិនចាំបាច់ចូលគណនី ·
      <RouterLink to="/register" class="font-medium text-brand-700 hover:underline">ចុះឈ្មោះ</RouterLink> ដើម្បីទទួលបានច្រើនជាងនេះ
    </p>

    <FeatureGrid class="mt-14" />
  </div>
</template>
