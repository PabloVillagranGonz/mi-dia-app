// Reconstruir un día tras sincronizar Google Calendar (issue #1).
//
// Reglas:
// 1. Los eventos de Google se colocan enteros; si dos se solapan, el que empieza antes gana
//    y el otro se recorta (si no queda nada, no aparece).
// 2. Todo lo demás (rutina, manuales, eventos manuales, editadas) se recorta alrededor.
// 3. Los tramos que deja libres un evento de Google que se mueve o desaparece se rellenan con
//    la rutina base. Fuera de esos tramos no se regenera nada: lo que el usuario borró a mano
//    ese día no vuelve.
// 4. Cambios mínimos: las filas que se mantienen conservan id, hecho y nota.

import type { DayChanges } from '@/data/store';
import type { DayActivity, ISODate, TemplateActivity } from '@/data/types';
import {
  externalId,
  stableUuid,
  type GoogleCalendarConfig,
  type GoogleEventRow,
} from './googleEvents';
import { fromRange, rangesOverlap, subtractRanges, toRange, type Range } from './intervals';
import { weekdayOf } from './time';
import type { DayActivityDraft } from './week';

export interface RebuildDayInput {
  date: ISODate;
  weekId: string;
  templates: readonly TemplateActivity[];
  /** Filas actuales (pueden incluir otros días: se filtran). */
  existing: readonly DayActivity[];
  /** Filas de `google_events` (pueden incluir otros días: sirven para saber si un evento cruza medianoche). */
  googleEvents: readonly GoogleEventRow[];
  /** Solo calendarios ACTIVOS. Los eventos de otros calendarios se ignoran (y se quitan del día). */
  calendars: readonly GoogleCalendarConfig[];
}

type Draft = DayActivityDraft;

/** Une franjas solapadas o contiguas. */
export function mergeRanges(ranges: readonly Range[]): Range[] {
  const sorted = [...ranges].filter((r) => r.end > r.start).sort((a, b) => a.start - b.start);
  const out: Range[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push({ ...r });
  }
  return out;
}

function intersect(a: Range, b: Range): Range | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}

const isGoogle = (a: Pick<DayActivity, 'external_id'>) => Boolean(a.external_id);

function draftOf(a: DayActivity): Draft {
  const { id: _id, user_id: _u, week_id: _w, ...rest } = a;
  return rest;
}

export function rebuildDay(input: RebuildDayInput): DayChanges {
  const { date, weekId, templates } = input;
  const ofDay = input.existing.filter((a) => a.date === date);
  const cfg = new Map(input.calendars.map((c) => [c.calendar_id, c]));

  const changes: DayChanges = { delete: [], update: [], insert: [] };
  const insert = (d: Draft) => changes.insert.push({ ...d, week_id: weekId });

  // ── 1. Eventos de Google deseados ────────────────────────────
  const multiDay = new Set<string>();
  const datesOf = new Map<string, Set<string>>();
  for (const g of input.googleEvents) {
    const k = externalId(g.calendar_id, g.event_id);
    const s = datesOf.get(k) ?? new Set<string>();
    s.add(g.date);
    datesOf.set(k, s);
    if (s.size > 1) multiDay.add(k);
  }

  const events = input.googleEvents
    .filter((g) => g.date === date && cfg.has(g.calendar_id))
    .map((g) => ({ g, ext: externalId(g.calendar_id, g.event_id), r: toRange(g) }))
    .sort((a, b) => a.r.start - b.r.start || a.r.end - b.r.end || (a.ext < b.ext ? -1 : a.ext > b.ext ? 1 : 0));

  const placed: Range[] = [];
  const desired = new Map<string, Draft>(); // clave ext#trozo
  for (const { g, ext, r } of events) {
    const c = cfg.get(g.calendar_id)!;
    subtractRanges(r, placed).forEach((piece, i) => {
      desired.set(`${ext}#${i}`, {
        date,
        ...fromRange(piece),
        title: g.title,
        category_id: c.category_id,
        kind: c.kind,
        origin: 'event',
        template_activity_id: null,
        split_group_id: multiDay.has(ext) ? stableUuid(ext) : null,
        notify: c.notify,
        edited: false,
        done: false,
        done_at: null,
        note: null,
        external_id: ext,
      });
    });
    placed.push(r);
  }
  const blockedByGoogle = mergeRanges(placed);

  // ── 2. Filas de Google actuales: comparar por clave ──────────
  const oldGoogle = ofDay.filter(isGoogle);
  const oldByKey = new Map<string, DayActivity>();
  const byExt = new Map<string, DayActivity[]>();
  for (const a of oldGoogle) byExt.set(a.external_id!, [...(byExt.get(a.external_id!) ?? []), a]);
  for (const [ext, rows] of byExt) {
    [...rows]
      .sort((x, y) => toRange(x).start - toRange(y).start)
      .forEach((a, i) => oldByKey.set(`${ext}#${i}`, a));
  }

  // Filas del mismo evento en otros días (para conservar hecho y nota si se mueve de día)
  const otherDays = new Map<string, DayActivity>();
  for (const a of input.existing) {
    if (a.date !== date && a.external_id && !otherDays.has(a.external_id)) otherDays.set(a.external_id, a);
  }

  const sameMeta = (a: DayActivity, d: Draft) =>
    a.title === d.title &&
    a.category_id === d.category_id &&
    a.kind === d.kind &&
    a.notify === d.notify &&
    a.split_group_id === d.split_group_id &&
    a.origin === 'event';

  for (const [key, d] of desired) {
    const old = oldByKey.get(key);
    // Si cambió el número de trozos, conservar hecho y nota de cualquier fila del mismo evento
    // …o, si el evento se ha movido de día, de su fila en el día anterior
    const carry = old ?? byExt.get(d.external_id!)?.[0] ?? otherDays.get(d.external_id!);
    const kept = carry ? { done: carry.done, done_at: carry.done_at, note: carry.note } : {};
    if (old && sameMeta(old, d)) {
      if (old.start_time !== d.start_time || old.end_time !== d.end_time) {
        changes.update.push({ id: old.id, start_time: d.start_time, end_time: d.end_time });
      }
    } else {
      if (old) changes.delete.push(old.id);
      insert({ ...d, ...kept });
    }
  }
  for (const [key, old] of oldByKey) if (!desired.has(key)) changes.delete.push(old.id);

  // Tramos que antes ocupaba Google y ahora quedan libres
  const freed = mergeRanges(
    mergeRanges(oldGoogle.map(toRange)).flatMap((r) => subtractRanges(r, blockedByGoogle)),
  );

  // ── 3. Lo demás se recorta alrededor de Google ───────────────
  interface Live {
    id: string | null; // null = trozo nuevo
    row: DayActivity;
    r: Range;
  }
  const live: Live[] = [];
  for (const a of ofDay.filter((x) => !isGoogle(x))) {
    const pieces = subtractRanges(toRange(a), blockedByGoogle);
    if (pieces.length === 0) changes.delete.push(a.id);
    pieces.forEach((p, i) => live.push({ id: i === 0 ? a.id : null, row: a, r: p }));
  }

  // ── 4. Rellenar con la rutina los tramos liberados ───────────
  if (freed.length) {
    const represented = new Set(
      ofDay.filter((a) => a.origin === 'template' && a.edited && a.template_activity_id).map((a) => a.template_activity_id!),
    );
    const weekday = weekdayOf(date);
    for (const t of templates) {
      if (t.weekday !== weekday || represented.has(t.id)) continue;
      for (const f of freed) {
        const inter = intersect(toRange(t), f);
        if (!inter) continue;
        const blockers = [...blockedByGoogle, ...live.map((l) => l.r)];
        for (const piece of subtractRanges(inter, blockers)) {
          const sameTemplate = (l: Live) =>
            l.row.origin === 'template' && !l.row.edited && l.row.template_activity_id === t.id;
          const left = live.find((l) => sameTemplate(l) && l.r.end === piece.start);
          const right = live.find((l) => sameTemplate(l) && l.r.start === piece.end);
          if (left) {
            left.r = { start: left.r.start, end: right ? right.r.end : piece.end };
            if (right) live.splice(live.indexOf(right), 1).forEach((x) => x.id && changes.delete.push(x.id));
          } else if (right) {
            right.r = { start: piece.start, end: right.r.end };
          } else {
            live.push({
              id: null,
              r: piece,
              row: {
                id: '',
                user_id: '',
                week_id: weekId,
                date,
                start_time: t.start_time,
                end_time: t.end_time,
                title: t.title,
                category_id: t.category_id,
                kind: t.kind,
                origin: 'template',
                template_activity_id: t.id,
                split_group_id: t.split_group_id,
                notify: t.notify,
                edited: false,
                done: false,
                done_at: null,
                note: null,
                external_id: null,
              },
            });
          }
        }
      }
    }
  }

  // ── 5. Volcar lo que quedó vivo ──────────────────────────────
  for (const l of live) {
    const slot = fromRange(l.r);
    if (l.id) {
      if (slot.start_time !== l.row.start_time || slot.end_time !== l.row.end_time) {
        changes.update.push({ id: l.id, ...slot });
      }
    } else {
      insert({ ...draftOf(l.row), ...slot });
    }
  }

  return changes;
}

/** ¿Algún evento de Google ocupa esta franja? (Para avisar al añadir eventos manuales). */
export function googleRangesOf(dayActivities: readonly DayActivity[]): Range[] {
  return mergeRanges(dayActivities.filter(isGoogle).map(toRange));
}

export const overlapsGoogle = (dayActivities: readonly DayActivity[], r: Range) =>
  googleRangesOf(dayActivities).some((g) => rangesOverlap(g, r));
