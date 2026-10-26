/** Output formats offered to the user, with label, icon and colours. */
import {
  mdiFileJpgBox,
  mdiFileDelimitedOutline,
  mdiFileDocumentOutline,
  mdiFileExcelOutline,
  mdiFilePngBox,
  mdiFilePowerpointOutline,
  mdiFileWordOutline,
} from '@mdi/js';
import type { Format } from '@/types';

export const FORMATS: Record<Format, { label: string; ext: string; desc: string; icon: string; color: string; bg: string }> = {
  docx: { label: 'Word', ext: 'DOCX', desc: 'កែសម្រួលអត្ថបទ តារាង រូបភាព', icon: mdiFileWordOutline, color: 'text-blue-600', bg: 'bg-blue-50' },
  pptx: { label: 'PowerPoint', ext: 'PPTX', desc: 'ស្លាយមួយទំព័រ ដូចដើមទាំងស្រុង', icon: mdiFilePowerpointOutline, color: 'text-orange-600', bg: 'bg-orange-50' },
  xlsx: { label: 'Excel', ext: 'XLSX', desc: 'ទាញយកតារាងទៅជាសន្លឹកកិច្ចការ', icon: mdiFileExcelOutline, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  csv: { label: 'CSV', ext: 'CSV', desc: 'ទិន្នន័យតារាង UTF-8 សម្រាប់ប្រព័ន្ធផ្សេងៗ', icon: mdiFileDelimitedOutline, color: 'text-teal-600', bg: 'bg-teal-50' },
  txt: { label: 'អត្ថបទ', ext: 'TXT', desc: 'អត្ថបទសុទ្ធ Unicode ខ្មែរត្រឹមត្រូវ', icon: mdiFileDocumentOutline, color: 'text-slate-600', bg: 'bg-slate-100' },
  png: { label: 'រូបភាព PNG', ext: 'PNG', desc: 'រូបភាពច្បាស់ មួយទំព័រមួយរូប', icon: mdiFilePngBox, color: 'text-violet-600', bg: 'bg-violet-50' },
  jpg: { label: 'រូបភាព JPG', ext: 'JPG', desc: 'រូបភាពទំហំតូច ងាយចែករំលែក', icon: mdiFileJpgBox, color: 'text-pink-600', bg: 'bg-pink-50' },
};

export const FORMAT_KEYS = Object.keys(FORMATS) as Format[];
