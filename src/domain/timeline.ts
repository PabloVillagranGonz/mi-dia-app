// Línea de tiempo del día: actividades + huecos «Tiempo libre» calculados, y estado AHORA (spec §4.4).

import { sortByStart, toRange, type Slot } from './intervals';
import { DAY_MINUTES, fromMinutes, toMinutes } from './time';

export interface Gap extends Slot {
  kind: 'gap';
}

export type TimelineItem<T> = { kind: 'activity'; activity: T } | Gap;

/**
 * Inserta huecos entre actividades, desde las 00:00 hasta las 24:00.
 * Las actividades deben ser del mismo día y no solaparse.
 */
export function buildTimeline<T extends Slot>(activities: readonly T[]): TimelineItem<T>[] {
  const items: TimelineItem<T>[] = [];
  let cursor = 0;
  for (const a of sortByStart(activities)) {
    const r = toRange(a);
    if (r.start > cursor) items.push(gap(cursor, r.start));
    items.push({ kind: 'activity', activity: a });
    cursor = Math.max(cursor, r.end);
  }
  if (cursor < DAY_MINUTES) items.push(gap(cursor, DAY_MINUTES));
  return items;
}

function gap(start: number, end: number): Gap {
  return { kind: 'gap', start_time: fromMinutes(start), end_time: fromMinutes(end) };
}

export interface NowState<T> {
  /** Actividad en curso (start <= ahora < end). */
  current: T | null;
  /** Hueco en curso si no hay actividad. */
  gap: Gap | null;
  /** Próxima actividad del día que empieza después de ahora. */
  next: T | null;
  /** Minutos hasta que termina lo actual (actividad o hueco). */
  minutesLeft: number;
  /** Minutos hasta que empieza `next` (null si no hay). */
  minutesToNext: number | null;
}

/**
 * `nowMinutes` puede llevar decimales (segundos) para cuentas atrás finas.
 * `tomorrowFirst`: primera actividad de mañana, para que a última hora «Siguiente» no quede vacío.
 */
export function nowState<T extends Slot>(
  activities: readonly T[],
  nowMinutes: number,
  tomorrowFirst: T | null = null,
): NowState<T> {
  const sorted = sortByStart(activities);
  const current = sorted.find((a) => toMinutes(a.start_time) <= nowMinutes && nowMinutes < toMinutes(a.end_time)) ?? null;
  const nextToday = sorted.find((a) => toMinutes(a.start_time) > nowMinutes) ?? null;
  const next = nextToday ?? tomorrowFirst;
  const minutesToNext = nextToday
    ? toMinutes(nextToday.start_time) - nowMinutes
    : tomorrowFirst
      ? DAY_MINUTES - nowMinutes + toMinutes(tomorrowFirst.start_time)
      : null;

  if (current) {
    return { current, gap: null, next, minutesLeft: toMinutes(current.end_time) - nowMinutes, minutesToNext };
  }
  const prevEnd = sorted.reduce((acc, a) => {
    const e = toMinutes(a.end_time);
    return e <= nowMinutes && e > acc ? e : acc;
  }, 0);
  const gapEnd = nextToday ? toMinutes(nextToday.start_time) : DAY_MINUTES;
  return {
    current: null,
    gap: { kind: 'gap', start_time: fromMinutes(prevEnd), end_time: fromMinutes(gapEnd) },
    next,
    minutesLeft: gapEnd - nowMinutes,
    minutesToNext,
  };
}
