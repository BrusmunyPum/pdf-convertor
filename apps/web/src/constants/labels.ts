/** Khmer labels + badge colours for statuses and ledger types. */
import type { JobStatus } from '@/types';

export const STATUS: Record<JobStatus, { label: string; cls: string }> = {
  QUEUED: { label: 'កំពុងរង់ចាំ', cls: 'bg-amber-50 text-amber-700' },
  PROCESSING: { label: 'កំពុងបម្លែង', cls: 'bg-brand-50 text-brand-700' },
  COMPLETED: { label: 'រួចរាល់', cls: 'bg-emerald-50 text-emerald-700' },
  FAILED: { label: 'បរាជ័យ', cls: 'bg-red-50 text-red-700' },
};

export const TX_TYPES: Record<string, string> = {
  SIGNUP_BONUS: 'ប្រាក់រង្វាន់ចុះឈ្មោះ',
  CONVERSION: 'បម្លែងឯកសារ',
  REFUND: 'បង្វិលសង',
  ADMIN_ADJUST: 'កែតម្រូវដោយអ្នកគ្រប់គ្រង',
  REQUEST_APPROVED: 'សំណើត្រូវបានអនុម័ត',
};

export const REQ_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING: { label: 'កំពុងរង់ចាំ', cls: 'bg-amber-50 text-amber-700' },
  APPROVED: { label: 'បានអនុម័ត', cls: 'bg-emerald-50 text-emerald-700' },
  REJECTED: { label: 'បានបដិសេធ', cls: 'bg-red-50 text-red-700' },
};
