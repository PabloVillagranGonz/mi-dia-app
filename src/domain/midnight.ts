// Partir una actividad que cruza medianoche en dos trozos (spec §2 y §4.3).

import type { HHMM } from '@/data/types';
import { toMinutes } from './time';

export interface DayPiece {
  /** 0 = el día de inicio, 1 = el día siguiente. */
  dayOffset: 0 | 1;
  start_time: HHMM;
  end_time: HHMM;
}

/**
 * - 10:00 → 12:00  ⇒ [día 0: 10:00–12:00]
 * - 23:00 → 01:00  ⇒ [día 0: 23:00–24:00, día 1: 00:00–01:00]
 * - 22:00 → 00:00  ⇒ [día 0: 22:00–24:00] (acabar a medianoche no parte)
 * - inicio == fin  ⇒ error (duración 0; 24 h no tiene sentido como actividad)
 */
export function splitAtMidnight(start: HHMM, end: HHMM): DayPiece[] {
  const s = toMinutes(start);
  let e = toMinutes(end);
  if (s >= 24 * 60) throw new Error('La hora de inicio no puede ser 24:00');
  if (e === 0) e = 24 * 60;
  if (e === s) throw new Error('La actividad no puede durar 0 minutos');
  if (e > s) return [{ dayOffset: 0, start_time: start, end_time: e === 24 * 60 ? '24:00' : end }];
  return [
    { dayOffset: 0, start_time: start, end_time: '24:00' },
    { dayOffset: 1, start_time: '00:00', end_time: end },
  ];
}

/** true si la franja introducida por el usuario cruza medianoche (y por tanto se partirá). */
export function crossesMidnight(start: HHMM, end: HHMM): boolean {
  return splitAtMidnight(start, end).length === 2;
}
