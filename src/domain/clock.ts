// «Ahora» en Europe/Madrid, independiente de la zona horaria del dispositivo.

import type { ISODate } from '@/data/types';

export const TIMEZONE = 'Europe/Madrid';

export interface LocalNow {
  date: ISODate;
  /** Minutos desde las 00:00 locales. */
  minutes: number;
  /** Segundos dentro del minuto (para cuentas atrás precisas). */
  seconds: number;
}

const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

export function localNow(now: Date = new Date()): LocalNow {
  const parts: Record<string, string> = {};
  for (const p of formatter.formatToParts(now)) parts[p.type] = p.value;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
    seconds: Number(parts.second),
  };
}

/**
 * Instante real (Date) de una hora local de Madrid: 'YYYY-MM-DD' + minutos desde 00:00.
 * Tiene en cuenta el cambio de hora. Una hora que no existe (la que se salta en marzo)
 * se adelanta; una que se repite (octubre) toma la primera.
 */
export function zonedToInstant(date: ISODate, minutes: number): Date {
  const [y, m, d] = date.split('-').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, 0, minutes);
  // Primera aproximación con el desfase de ese momento, y corrección por si cruza el cambio de hora
  let guess = wallAsUtc - offsetMinutes(new Date(wallAsUtc)) * 60_000;
  guess = wallAsUtc - offsetMinutes(new Date(guess)) * 60_000;
  return new Date(guess);
}

/** Desfase de Madrid respecto a UTC en ese instante (60 en invierno, 120 en verano). */
function offsetMinutes(instant: Date): number {
  const l = localNow(instant);
  const [y, m, d] = l.date.split('-').map(Number);
  const localAsUtc = Date.UTC(y, m - 1, d, 0, l.minutes, l.seconds);
  return Math.round((localAsUtc - Math.floor(instant.getTime() / 1000) * 1000) / 60_000);
}

/** «Buenos días» (6–14), «Buenas tardes» (14–21), «Buenas noches». */
export function greeting(minutes: number): string {
  if (minutes >= 6 * 60 && minutes < 14 * 60) return 'Buenos días';
  if (minutes >= 14 * 60 && minutes < 21 * 60) return 'Buenas tardes';
  return 'Buenas noches';
}
