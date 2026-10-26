/** Display formatting: Khmer digits, sizes, dates, converter warnings in Khmer. */

const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩';
export const khNum = (n: number | string) => String(n).replace(/\d/g, (d) => KHMER_DIGITS[Number(d)]);

export function fileSize(bytes: number | null | undefined) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const dtf = new Intl.DateTimeFormat('km-KH', { dateStyle: 'medium', timeStyle: 'short' });
const df = new Intl.DateTimeFormat('km-KH', { day: 'numeric', month: 'short' });
export const dateTime = (d: string | Date | null | undefined) => (d ? dtf.format(new Date(d)) : '—');
export const shortDate = (d: string | Date) => df.format(new Date(d));

export function timeAgo(d: string | Date) {
  const s = Math.round((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return 'អម្បាញ់មិញ';
  if (s < 3600) return `${khNum(Math.floor(s / 60))} នាទីមុន`;
  if (s < 86400) return `${khNum(Math.floor(s / 3600))} ម៉ោងមុន`;
  if (s < 86400 * 7) return `${khNum(Math.floor(s / 86400))} ថ្ងៃមុន`;
  return dateTime(d);
}

/** Converter warnings come in English; show them in Khmer. */
export function warningKh(w: string) {
  if (w.startsWith('Scanned pages kept as pictures (OCR')) return 'ទំព័រស្កេនត្រូវបានរក្សាជារូបភាព (អត្ថបទ OCR នៅក្នុងកំណត់ចំណាំស្លាយ)';
  if (w.startsWith('Scanned pages kept as pictures')) return 'ទំព័រស្កេនត្រូវបានរក្សាជារូបភាព៖ ' + w.split(':')[1];
  if (w.startsWith('No ruled tables found')) return 'រកមិនឃើញតារាងមានបន្ទាត់ — អត្ថបទត្រូវបាននាំចេញជាជួរៗ';
  if (w.startsWith('OCR engine is not installed')) return 'ម៉ាស៊ីន OCR មិនទាន់ដំឡើង — ទំព័រស្កេនត្រូវបានរក្សាជារូបភាព';
  if (w.startsWith('Fonts not available on the server')) return 'ពុម្ពអក្សរខ្លះមិនមាននៅលើម៉ាស៊ីនមេ (មិនបានបង្កប់)៖ ' + w.split(':')[1];
  return w;
}

/** Converter progress stages (English) -> short Khmer text. */
export function stageKh(stage: string | undefined) {
  const s = stage ?? '';
  if (s.startsWith('Repairing')) return 'កំពុងជួសជុលអក្សរខ្មែរ…';
  if (s.startsWith('Analysing')) return 'កំពុងវិភាគទំព័រ…';
  if (s.startsWith('OCR')) return 'កំពុងស្គាល់អក្សរ (OCR)…';
  if (s.startsWith('Finishing')) return 'កំពុងរៀបចំឯកសារចុងក្រោយ…';
  if (s.startsWith('Page') || s.startsWith('Slide') || s.startsWith('Layout')) return `កំពុងបម្លែង ${s.replace(/\D+/g, ' ').trim().split(' ').map(khNum).join('–')}`;
  return 'កំពុងបម្លែង…';
}
