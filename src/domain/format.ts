import type { Slot } from './intervals';

/** «14:00–15:00» */
export function formatDurationRange(s: Slot): string {
  return `${s.start_time}–${s.end_time}`;
}

/** «ahora», «hace 5 min», «hace 3 h», «ayer», «hace 4 días», «12 oct 2026». `null` → «nunca». */
export function formatSince(iso: string | null, now: Date = new Date()): string {
  if (!iso) return 'nunca';
  const then = new Date(iso);
  const min = Math.floor((now.getTime() - then.getTime()) / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ayer';
  if (d < 30) return `hace ${d} días`;
  const months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  return `${then.getDate()} ${months[then.getMonth()]} ${then.getFullYear()}`;
}

/** «2 h 30 min» a partir de minutos (para horas por categoría). */
export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}
