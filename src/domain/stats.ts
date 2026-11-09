// Estadísticas de un usuario para el panel de administración. Lógica pura: la usa la
// Edge Function `admin` (empaquetada en supabase/functions/_shared/domain.js).
//
// - Progreso por semana: tareas hechas / tareas (las fijas no cuentan, como en la app).
// - Racha: días seguidos «cumplidos» (al menos la mitad de sus tareas hechas) que acaban hoy
//   o ayer. Hoy solo suma si ya está cumplido: un día a medias no rompe la racha hasta que pasa.
// - Horas por categoría: tiempo planificado hasta hoy (incluido), de todas las actividades.

import type { DayActivity, ISODate } from '@/data/types';
import { progressOf } from './progress';
import { addDays, compareDates, toMinutes, weekStartOf } from './time';

type Act = Pick<DayActivity, 'date' | 'start_time' | 'end_time' | 'kind' | 'done' | 'category_id'>;

export interface WeekStat {
  week_start: ISODate;
  done: number;
  total: number;
  ratio: number;
}

export interface CategoryMinutes {
  category_id: string | null;
  minutes: number;
}

export interface UserStats {
  /** Semanas con actividad, de la más reciente a la más antigua. */
  weeks: WeekStat[];
  /** Días seguidos cumplidos hasta hoy/ayer. */
  streak: number;
  /** Mejor racha dentro del periodo. */
  bestStreak: number;
  /** Minutos planificados por categoría (hasta hoy), de más a menos. */
  categories: CategoryMinutes[];
  /** Último día con alguna tarea marcada como hecha. */
  lastDoneDate: ISODate | null;
}

/** Un día cuenta para la racha si tiene tareas y al menos la mitad están hechas. */
export const DAY_GOAL = 0.5;

export function dayAccomplished(acts: readonly Pick<Act, 'kind' | 'done'>[]): boolean {
  const p = progressOf(acts);
  return p.total > 0 && p.ratio >= DAY_GOAL;
}

export function userStats(activities: readonly Act[], today: ISODate): UserStats {
  const upToToday = activities.filter((a) => compareDates(a.date, today) <= 0);

  // Por día
  const byDay = new Map<ISODate, Act[]>();
  for (const a of upToToday) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a]);

  // Semanas
  const byWeek = new Map<ISODate, Act[]>();
  for (const a of upToToday) {
    const w = weekStartOf(a.date);
    byWeek.set(w, [...(byWeek.get(w) ?? []), a]);
  }
  const weeks = [...byWeek.entries()]
    .map(([week_start, acts]) => ({ week_start, ...progressOf(acts) }))
    .sort((a, b) => compareDates(b.week_start, a.week_start));

  // Racha actual: desde hoy (si ya está cumplido) o desde ayer hacia atrás
  const ok = (d: ISODate) => dayAccomplished(byDay.get(d) ?? []);
  let streak = 0;
  for (let d = ok(today) ? today : addDays(today, -1); ok(d); d = addDays(d, -1)) streak++;

  // Mejor racha del periodo
  const days = [...byDay.keys()].sort(compareDates);
  let bestStreak = 0;
  let run = 0;
  let prev: ISODate | null = null;
  for (const d of days) {
    if (!ok(d)) {
      run = 0;
    } else {
      run = prev && addDays(prev, 1) === d && run > 0 ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
    }
    prev = d;
  }

  // Minutos por categoría
  const minutes = new Map<string | null, number>();
  for (const a of upToToday) {
    const m = toMinutes(a.end_time) - toMinutes(a.start_time);
    minutes.set(a.category_id, (minutes.get(a.category_id) ?? 0) + m);
  }
  const categories = [...minutes.entries()]
    .map(([category_id, m]) => ({ category_id, minutes: m }))
    .sort((a, b) => b.minutes - a.minutes);

  const doneDays = upToToday.filter((a) => a.done).map((a) => a.date).sort(compareDates);
  return { weeks, streak, bestStreak, categories, lastDoneDate: doneDays[doneDays.length - 1] ?? null };
}
