// Eventos puntuales: recortan o sustituyen la rutina de ese día (spec §4.2).

import type { DayActivity } from '@/data/types';
import { fromRange, rangesOverlap, subtractRange, toRange, type Slot } from './intervals';

type Activity = Pick<DayActivity, 'id' | 'start_time' | 'end_time' | 'origin'>;

export interface EventPlan<T extends Activity> {
  /** Actividades totalmente cubiertas por el evento. */
  toDelete: string[];
  /** Actividades recortadas por un extremo, o primer trozo si el evento cae en medio. */
  toUpdate: Array<{ id: string } & Slot>;
  /** Segundo trozo cuando el evento cae en medio: copia de la original con otras horas. */
  toInsert: Array<Omit<T, 'id'> & Slot>;
}

export type EventResult<T extends Activity> =
  | { ok: true; plan: EventPlan<T> }
  | { ok: false; reason: 'event_overlap'; conflicts: T[] };

/**
 * Calcula qué hacer con las actividades de un día al añadir un evento.
 * `dayActivities`: todas las del día (incluidos otros eventos). Si se edita un evento,
 * pásalo en `ignoreIds` para que no choque consigo mismo.
 */
export function planEvent<T extends Activity>(
  dayActivities: readonly T[],
  event: Slot,
  ignoreIds: readonly string[] = [],
): EventResult<T> {
  const ev = toRange(event);
  const others = dayActivities.filter((a) => !ignoreIds.includes(a.id));

  const eventConflicts = others.filter((a) => a.origin === 'event' && rangesOverlap(toRange(a), ev));
  if (eventConflicts.length) return { ok: false, reason: 'event_overlap', conflicts: eventConflicts };

  const plan: EventPlan<T> = { toDelete: [], toUpdate: [], toInsert: [] };

  for (const a of others) {
    const r = toRange(a);
    if (!rangesOverlap(r, ev)) continue;
    const pieces = subtractRange(r, ev);
    if (pieces.length === 0) {
      plan.toDelete.push(a.id);
    } else {
      plan.toUpdate.push({ id: a.id, ...fromRange(pieces[0]) });
      if (pieces.length === 2) {
        const { id: _omit, ...rest } = a;
        plan.toInsert.push({ ...(rest as Omit<T, 'id'>), ...fromRange(pieces[1]) });
      }
    }
  }
  return { ok: true, plan };
}

/** Aplica un plan sobre una lista en memoria (para datos de prueba y tests). */
export function applyEventPlan<T extends Activity>(
  list: readonly T[],
  plan: EventPlan<T>,
  newId: () => string,
): T[] {
  const updates = new Map(plan.toUpdate.map((u) => [u.id, u]));
  const kept = list
    .filter((a) => !plan.toDelete.includes(a.id))
    .map((a) => {
      const u = updates.get(a.id);
      return u ? { ...a, start_time: u.start_time, end_time: u.end_time } : a;
    });
  const inserted = plan.toInsert.map((p) => ({ ...p, id: newId() }) as unknown as T);
  return [...kept, ...inserted];
}
