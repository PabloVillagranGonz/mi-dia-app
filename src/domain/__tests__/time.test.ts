import { localNow, greeting } from '../clock';
import {
  addDays,
  formatDuration,
  formatLongDate,
  fromMinutes,
  nextWeekday,
  normalizeTime,
  toMinutes,
  weekDates,
  weekStartOf,
  weekdayOf,
} from '../time';

describe('horas', () => {
  test('toMinutes / fromMinutes, incluido 24:00', () => {
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('09:30')).toBe(570);
    expect(toMinutes('24:00')).toBe(1440);
    expect(toMinutes('09:30:00')).toBe(570);
    expect(fromMinutes(570)).toBe('09:30');
    expect(fromMinutes(1440)).toBe('24:00');
  });

  test('rechaza horas imposibles', () => {
    expect(() => toMinutes('24:30')).toThrow();
    expect(() => toMinutes('10:60')).toThrow();
    expect(() => toMinutes('nope')).toThrow();
    expect(() => fromMinutes(1441)).toThrow();
  });

  test('normalizeTime quita los segundos de Postgres', () => {
    expect(normalizeTime('21:30:00')).toBe('21:30');
    expect(normalizeTime('24:00:00')).toBe('24:00');
  });

  test('formatDuration', () => {
    expect(formatDuration(25)).toBe('25 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(90)).toBe('1 h 30 min');
    expect(formatDuration(-3)).toBe('0 min');
  });
});

describe('fechas', () => {
  test('semana de lunes a domingo', () => {
    expect(weekdayOf('2026-11-09')).toBe(1); // lunes
    expect(weekdayOf('2026-11-15')).toBe(7); // domingo
    expect(weekStartOf('2026-11-15')).toBe('2026-11-09');
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    expect(weekDates('2026-11-09')).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ]);
  });

  test('addDays atraviesa meses, años y cambios de hora', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-12-28', 7)).toBe('2027-01-04');
    expect(addDays('2026-10-24', 1)).toBe('2026-10-25'); // cambio de hora en España
    expect(addDays('2027-03-28', -1)).toBe('2027-03-27');
  });

  test('nextWeekday: domingo → lunes', () => {
    expect(nextWeekday(7)).toBe(1);
    expect(nextWeekday(3)).toBe(4);
  });

  test('formatLongDate', () => {
    expect(formatLongDate('2026-11-09')).toBe('Lunes 9 de noviembre');
    expect(formatLongDate('2026-11-11')).toBe('Miércoles 11 de noviembre');
  });
});

describe('reloj Europe/Madrid', () => {
  test('convierte UTC a hora de Madrid (invierno, UTC+1)', () => {
    const n = localNow(new Date('2026-11-09T22:45:10Z'));
    expect(n).toEqual({ date: '2026-11-09', minutes: 23 * 60 + 45, seconds: 10 });
  });

  test('pasa de día a medianoche local', () => {
    expect(localNow(new Date('2026-11-09T23:10:00Z')).date).toBe('2026-11-10');
  });

  test('verano, UTC+2', () => {
    expect(localNow(new Date('2026-07-01T07:30:00Z')).minutes).toBe(9 * 60 + 30);
  });

  test('saludo', () => {
    expect(greeting(9 * 60)).toBe('Buenos días');
    expect(greeting(15 * 60)).toBe('Buenas tardes');
    expect(greeting(23 * 60)).toBe('Buenas noches');
    expect(greeting(2 * 60)).toBe('Buenas noches');
  });
});
