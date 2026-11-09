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

/** «Buenos días» (6–14), «Buenas tardes» (14–21), «Buenas noches». */
export function greeting(minutes: number): string {
  if (minutes >= 6 * 60 && minutes < 14 * 60) return 'Buenos días';
  if (minutes >= 14 * 60 && minutes < 21 * 60) return 'Buenas tardes';
  return 'Buenas noches';
}
