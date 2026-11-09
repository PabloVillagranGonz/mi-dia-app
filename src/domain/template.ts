// Rutina base: alta/edición con partición en medianoche y validación de solapes (spec §4.3).

import type { HHMM, TemplateActivity, Weekday } from '@/data/types';
import { slotsOverlap } from './intervals';
import { splitAtMidnight } from './midnight';
import { nextWeekday } from './time';

export interface TemplateInput {
  weekday: Weekday;
  /** Puede ser menor que start_time: entonces cruza medianoche y se parte. */
  start_time: HHMM;
  end_time: HHMM;
}

export interface TemplateRow {
  weekday: Weekday;
  start_time: HHMM;
  end_time: HHMM;
}

/** Filas a guardar: una, o dos (día N y N+1, domingo → lunes) si cruza medianoche. */
export function templateRows(input: TemplateInput): TemplateRow[] {
  return splitAtMidnight(input.start_time, input.end_time).map((p) => ({
    weekday: p.dayOffset === 0 ? input.weekday : nextWeekday(input.weekday),
    start_time: p.start_time,
    end_time: p.end_time,
  }));
}

/**
 * Comprueba que las filas nuevas no choquen con la rutina existente de su día.
 * `ignoreIds`: las filas que se están editando (ambas mitades si van enlazadas).
 */
export function templateConflicts(
  rows: readonly TemplateRow[],
  existing: readonly TemplateActivity[],
  ignoreIds: readonly string[] = [],
): TemplateActivity[] {
  return existing.filter(
    (e) => !ignoreIds.includes(e.id) && rows.some((r) => r.weekday === e.weekday && slotsOverlap(r, e)),
  );
}

/** Ids de la actividad y de su otra mitad (si cruza medianoche). */
export function linkedIds<T extends { id: string; split_group_id: string | null }>(
  item: T,
  all: readonly T[],
): string[] {
  if (!item.split_group_id) return [item.id];
  return all.filter((a) => a.split_group_id === item.split_group_id).map((a) => a.id);
}

/**
 * «Copiar este día a…»: filas de `fromWeekday` duplicadas en cada destino.
 * Las mitades de medianoche se copian como filas sueltas (sin enlace) en el destino.
 */
export function copyDayRows(
  templates: readonly TemplateActivity[],
  fromWeekday: Weekday,
  toWeekdays: readonly Weekday[],
): Array<Omit<TemplateActivity, 'id' | 'user_id'>> {
  const source = templates.filter((t) => t.weekday === fromWeekday);
  return toWeekdays
    .filter((w) => w !== fromWeekday)
    .flatMap((w) =>
      source.map(({ id: _id, user_id: _u, ...t }) => ({ ...t, weekday: w, split_group_id: null })),
    );
}
