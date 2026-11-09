// Validación de una franja nueva o editada frente a las existentes del mismo día.

import { slotsOverlap, type Slot } from './intervals';
import { formatDurationRange } from './format';
import { toMinutes } from './time';

export type ValidationResult<T> =
  | { ok: true }
  | { ok: false; reason: 'invalid_range' | 'empty_title' }
  | { ok: false; reason: 'overlap'; conflicts: T[] };

/**
 * Comprueba que `candidate` no se solape con `existing`.
 * `ignoreIds`: la propia actividad al editarla (y su otra mitad si cruza medianoche).
 */
export function validateNoOverlap<T extends Slot & { id: string }>(
  candidate: Slot,
  existing: readonly T[],
  ignoreIds: readonly string[] = [],
): ValidationResult<T> {
  if (toMinutes(candidate.end_time) <= toMinutes(candidate.start_time)) {
    return { ok: false, reason: 'invalid_range' };
  }
  const conflicts = existing.filter((e) => !ignoreIds.includes(e.id) && slotsOverlap(e, candidate));
  return conflicts.length ? { ok: false, reason: 'overlap', conflicts } : { ok: true };
}

/** Mensaje en español para mostrar al usuario. */
export function validationMessage<T extends Slot & { title: string }>(r: ValidationResult<T>): string | null {
  if (r.ok) return null;
  switch (r.reason) {
    case 'invalid_range':
      return 'La hora de fin debe ser posterior a la de inicio.';
    case 'empty_title':
      return 'Ponle un nombre a la actividad.';
    case 'overlap': {
      const c = r.conflicts[0];
      const more = r.conflicts.length > 1 ? ` y ${r.conflicts.length - 1} más` : '';
      return `Se solapa con «${c.title}» (${formatDurationRange(c)})${more}.`;
    }
  }
}
