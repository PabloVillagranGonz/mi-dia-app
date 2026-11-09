// Qué notificaciones programar (spec §4.5). Pura: el módulo src/notifications/ solo las entrega al sistema.

import type { DayActivity, Weekday } from '@/data/types';
import { zonedToInstant } from './clock';
import { sortByStart } from './intervals';
import { toMinutes } from './time';

/** iOS admite 64 pendientes: dejamos margen para el recordatorio semanal y la de prueba. */
export const MAX_ACTIVITY_NOTIFICATIONS = 60;

export interface PlannedNotification {
  /** Estable por actividad: permite reprogramar sin duplicar. */
  id: string;
  title: string;
  body: string;
  at: Date;
}

type Activity = Pick<DayActivity, 'id' | 'date' | 'start_time' | 'end_time' | 'title' | 'notify' | 'split_group_id'>;

/**
 * Avisos al inicio de cada actividad con `notify`, a partir de `now`.
 * - Cuerpo: «Hasta las HH:MM · Siguiente: X» (o solo «Hasta las HH:MM»).
 * - La segunda mitad de una actividad que cruza medianoche no avisa (ya avisó al empezar).
 */
export function planActivityNotifications(activities: readonly Activity[], now: Date): PlannedNotification[] {
  const ordered = [...activities].sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? -1 : 1));
  const byDate = new Map<string, Activity[]>();
  for (const a of ordered) byDate.set(a.date, [...(byDate.get(a.date) ?? []), a]);
  const sequence = [...byDate.keys()].sort().flatMap((d) => sortByStart(byDate.get(d)!));

  const out: PlannedNotification[] = [];
  sequence.forEach((a, i) => {
    if (!a.notify) return;
    const isSecondHalf =
      a.start_time === '00:00' &&
      a.split_group_id != null &&
      sequence.some((b) => b.split_group_id === a.split_group_id && b.end_time === '24:00');
    if (isSecondHalf) return;

    const at = zonedToInstant(a.date, toMinutes(a.start_time));
    if (at.getTime() <= now.getTime()) return;

    // Siguiente: la próxima que empieza después de esta (saltando su propia segunda mitad)
    const next = sequence
      .slice(i + 1)
      .find((b) => !(a.split_group_id && b.split_group_id === a.split_group_id));
    const end = a.end_time === '24:00' ? '00:00' : a.end_time;
    out.push({
      id: `act:${a.id}`,
      title: a.title,
      body: next ? `Hasta las ${end} · Siguiente: ${next.title}` : `Hasta las ${end}`,
      at,
    });
  });
  return out.slice(0, MAX_ACTIVITY_NOTIFICATIONS);
}

/** expo-notifications usa 1 = domingo … 7 = sábado; nosotros 1 = lunes … 7 = domingo. */
export function toExpoWeekday(w: Weekday): number {
  return (w % 7) + 1;
}
