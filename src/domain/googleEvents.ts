// Eventos de Google Calendar → filas locales por día (Europe/Madrid). Lógica pura:
// la usan la app y las Edge Functions (empaquetada en supabase/functions/_shared/domain.js).

import type { ActivityKind, HHMM, ISODate } from '@/data/types';
import { localNow, zonedToInstant } from './clock';
import { fromMinutes, addDays, compareDates, weekStartOf } from './time';

/** Lo que usamos de un evento de la API de Google Calendar (events.list). */
export interface GoogleApiEvent {
  id: string;
  status?: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  updated?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
}

/** Una fila de `google_events`: el trozo de un evento que cae en un día. */
export interface GoogleEventRow {
  calendar_id: string;
  event_id: string;
  date: ISODate;
  start_time: HHMM;
  end_time: HHMM;
  title: string;
  updated: string;
}

/** Ajustes de un calendario activo: cómo se materializan sus eventos. */
export interface GoogleCalendarConfig {
  calendar_id: string;
  category_id: string | null;
  kind: ActivityKind;
  notify: boolean;
}

export interface DayPieceOf {
  date: ISODate;
  start_time: HHMM;
  end_time: HHMM;
}

export const UNTITLED = '(Sin título)';

/** Identificador estable en `day_activities.external_id`. */
export const externalId = (calendarId: string, eventId: string) => `gcal:${calendarId}:${eventId}`;

/**
 * Convierte un evento en trozos locales de Madrid, uno por día (parte en medianoche).
 * Devuelve [] para eventos de todo el día, cancelados o de duración 0.
 */
export function toDayPieces(event: GoogleApiEvent): DayPieceOf[] {
  if (event.status === 'cancelled') return [];
  const s = event.start?.dateTime;
  const e = event.end?.dateTime;
  if (!s || !e) return []; // todo el día (start.date) o incompleto
  const start = localNow(new Date(s));
  const end = localNow(new Date(e));
  if (new Date(e).getTime() <= new Date(s).getTime()) return [];

  const out: DayPieceOf[] = [];
  for (let d = start.date; compareDates(d, end.date) <= 0; d = addDays(d, 1)) {
    const from = d === start.date ? start.minutes : 0;
    const to = d === end.date ? end.minutes : 24 * 60;
    if (to > from) out.push({ date: d, start_time: fromMinutes(from), end_time: fromMinutes(to) });
  }
  return out;
}

/** Filas de `google_events` de un evento, recortadas a la ventana [from, to] (fechas inclusivas). */
export function eventRows(calendarId: string, event: GoogleApiEvent, window: SyncWindow): GoogleEventRow[] {
  return toDayPieces(event)
    .filter((p) => compareDates(p.date, window.from) >= 0 && compareDates(p.date, window.to) <= 0)
    .map((p) => ({
      calendar_id: calendarId,
      event_id: event.id,
      ...p,
      title: event.summary?.trim() || UNTITLED,
      updated: event.updated ?? new Date(0).toISOString(),
    }));
}

/** Semana actual + la siguiente: de lunes a domingo (fechas inclusivas). */
export interface SyncWindow {
  from: ISODate;
  to: ISODate;
  /** Instantes para timeMin/timeMax de la API (lunes 00:00 → lunes de dentro de 2 semanas 00:00, Madrid). */
  timeMin: string;
  timeMax: string;
}

export function syncWindow(today: ISODate): SyncWindow {
  const from = weekStartOf(today);
  const after = addDays(from, 14);
  return {
    from,
    to: addDays(after, -1),
    timeMin: zonedToInstant(from, 0).toISOString(),
    timeMax: zonedToInstant(after, 0).toISOString(),
  };
}

export interface EventsSyncPlan {
  /** Filas nuevas o cambiadas (upsert por calendar_id + event_id + date). */
  upsert: GoogleEventRow[];
  /** Filas que sobran: eventos borrados, movidos de día o fuera de la ventana. */
  remove: Pick<GoogleEventRow, 'event_id' | 'date'>[];
}

const rowKey = (r: Pick<GoogleEventRow, 'event_id' | 'date'>) => `${r.event_id}|${r.date}`;

/**
 * Qué cambiar en `google_events` de UN calendario tras una llamada a events.list.
 * - `full`: la respuesta es el calendario entero en la ventana (lo que no venga, sobra).
 * - incremental (syncToken): solo vienen los eventos que cambiaron; los borrados llegan como `cancelled`.
 * En ambos casos se quitan las filas que hayan quedado fuera de la ventana.
 */
export function planEventsSync(
  calendarId: string,
  current: readonly GoogleEventRow[],
  items: readonly GoogleApiEvent[],
  full: boolean,
  window: SyncWindow,
): EventsSyncPlan {
  const touched = new Set(items.map((i) => i.id));
  const desired = items.flatMap((i) => eventRows(calendarId, i, window));
  const desiredKeys = new Set(desired.map(rowKey));
  const currentByKey = new Map(current.map((r) => [rowKey(r), r]));

  const remove = current
    .filter((r) => {
      const outside = compareDates(r.date, window.from) < 0 || compareDates(r.date, window.to) > 0;
      if (outside) return true;
      if (full || touched.has(r.event_id)) return !desiredKeys.has(rowKey(r));
      return false;
    })
    .map(({ event_id, date }) => ({ event_id, date }));

  const upsert = desired.filter((d) => {
    const c = currentByKey.get(rowKey(d));
    return !c || c.start_time !== d.start_time || c.end_time !== d.end_time || c.title !== d.title;
  });
  return { upsert, remove };
}

/** UUID estable a partir de un texto (para enlazar las dos mitades de un evento que cruza medianoche). */
export function stableUuid(text: string): string {
  // 4 × FNV-1a de 32 bits con semillas distintas → 128 bits
  const parts = [0x811c9dc5, 0x01000193, 0x9e3779b9, 0x85ebca6b].map((seed) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  });
  const hex = parts.join('');
  // Forma de UUID v4 (versión y variante fijas) para que Postgres lo acepte como uuid
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
