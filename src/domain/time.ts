// Horas 'HH:MM' ↔ minutos y aritmética de fechas 'YYYY-MM-DD'.
// Las fechas se manejan como texto + UTC para que el cambio de hora no las mueva.

import type { HHMM, ISODate, Weekday } from '@/data/types';

export const DAY_MINUTES = 24 * 60;

/** 'HH:MM' o 'HH:MM:SS' → minutos desde 00:00. '24:00' → 1440. */
export function toMinutes(time: string): number {
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(time);
  if (!m) throw new Error(`Hora no válida: ${time}`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min !== 0)) throw new Error(`Hora no válida: ${time}`);
  return h * 60 + min;
}

/** minutos → 'HH:MM'. 1440 → '24:00'. */
export function fromMinutes(total: number): HHMM {
  if (!Number.isInteger(total) || total < 0 || total > DAY_MINUTES) {
    throw new Error(`Minutos fuera de rango: ${total}`);
  }
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Normaliza lo que devuelve Postgres ('09:00:00') a 'HH:MM'. */
export function normalizeTime(time: string): HHMM {
  return fromMinutes(toMinutes(time));
}

/** «25 min», «1 h», «1 h 30 min». */
export function formatDuration(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

// ── Fechas ──────────────────────────────────────────────────────

function parseDate(date: ISODate): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`Fecha no válida: ${date}`);
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
}

function formatDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function addDays(date: ISODate, days: number): ISODate {
  const d = parseDate(date);
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/** 1 = lunes … 7 = domingo */
export function weekdayOf(date: ISODate): Weekday {
  const js = parseDate(date).getUTCDay(); // 0 = domingo
  return (js === 0 ? 7 : js) as Weekday;
}

/** Lunes de la semana que contiene `date`. */
export function weekStartOf(date: ISODate): ISODate {
  return addDays(date, 1 - weekdayOf(date));
}

/** Las 7 fechas (lunes → domingo) de la semana que empieza en `weekStart`. */
export function weekDates(weekStart: ISODate): ISODate[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

/** Siguiente día de la semana (domingo → lunes). */
export function nextWeekday(w: Weekday): Weekday {
  return (w === 7 ? 1 : w + 1) as Weekday;
}

const WEEKDAY_NAMES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const WEEKDAY_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export function weekdayName(w: Weekday): string {
  return WEEKDAY_NAMES[w - 1];
}

export function weekdayShort(w: Weekday): string {
  return WEEKDAY_SHORT[w - 1];
}

/** «Lunes 9 de noviembre» */
export function formatLongDate(date: ISODate): string {
  const d = parseDate(date);
  const name = weekdayName(weekdayOf(date));
  return `${name[0].toUpperCase()}${name.slice(1)} ${d.getUTCDate()} de ${MONTH_NAMES[d.getUTCMonth()]}`;
}

/** «9 nov» */
export function formatShortDate(date: ISODate): string {
  const d = parseDate(date);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()].slice(0, 3)}`;
}

/** Compara fechas ISO: <0, 0, >0 */
export function compareDates(a: ISODate, b: ISODate): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
