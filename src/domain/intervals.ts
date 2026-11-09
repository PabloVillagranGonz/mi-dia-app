// Operaciones con franjas horarias de un mismo día: solapes y recortes.

import type { HHMM } from '@/data/types';
import { fromMinutes, toMinutes } from './time';

export interface Slot {
  start_time: HHMM;
  end_time: HHMM;
}

export interface Range {
  start: number; // minutos
  end: number;   // minutos, exclusivo
}

export const toRange = (s: Slot): Range => ({ start: toMinutes(s.start_time), end: toMinutes(s.end_time) });
export const fromRange = (r: Range): Slot => ({ start_time: fromMinutes(r.start), end_time: fromMinutes(r.end) });

/** Dos franjas se solapan si comparten algún minuto. Tocarse (10:00–11:00 / 11:00–12:00) no es solape. */
export function rangesOverlap(a: Range, b: Range): boolean {
  return a.start < b.end && b.start < a.end;
}

export function slotsOverlap(a: Slot, b: Slot): boolean {
  return rangesOverlap(toRange(a), toRange(b));
}

/** Resta `cut` a `base`: devuelve 0, 1 o 2 trozos. */
export function subtractRange(base: Range, cut: Range): Range[] {
  if (!rangesOverlap(base, cut)) return [base];
  const out: Range[] = [];
  if (cut.start > base.start) out.push({ start: base.start, end: cut.start });
  if (cut.end < base.end) out.push({ start: cut.end, end: base.end });
  return out;
}

/** Resta varias franjas a `base`. */
export function subtractRanges(base: Range, cuts: Range[]): Range[] {
  let pieces = [base];
  for (const cut of cuts) pieces = pieces.flatMap((p) => subtractRange(p, cut));
  return pieces;
}

/** Ordena por hora de inicio (y fin). No muta. */
export function sortByStart<T extends Slot>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const d = toMinutes(a.start_time) - toMinutes(b.start_time);
    return d !== 0 ? d : toMinutes(a.end_time) - toMinutes(b.end_time);
  });
}
