import { zonedToInstant } from '../clock';
import { planActivityNotifications, toExpoWeekday } from '../notifications';

describe('hora de Madrid → instante', () => {
  test('invierno (UTC+1) y verano (UTC+2)', () => {
    expect(zonedToInstant('2026-11-09', 9 * 60).toISOString()).toBe('2026-11-09T08:00:00.000Z');
    expect(zonedToInstant('2026-07-01', 9 * 60).toISOString()).toBe('2026-07-01T07:00:00.000Z');
  });

  test('día del cambio de hora de octubre (25-10-2026)', () => {
    expect(zonedToInstant('2026-10-25', 1 * 60).toISOString()).toBe('2026-10-24T23:00:00.000Z'); // aún verano
    expect(zonedToInstant('2026-10-25', 12 * 60).toISOString()).toBe('2026-10-25T11:00:00.000Z'); // ya invierno
  });

  test('día del cambio de hora de marzo (28-03-2027)', () => {
    expect(zonedToInstant('2027-03-28', 1 * 60).toISOString()).toBe('2027-03-28T00:00:00.000Z'); // invierno
    expect(zonedToInstant('2027-03-28', 9 * 60).toISOString()).toBe('2027-03-28T07:00:00.000Z'); // verano
  });

  test('medianoche (24:00 = 00:00 del día siguiente)', () => {
    expect(zonedToInstant('2026-11-09', 24 * 60).toISOString()).toBe('2026-11-09T23:00:00.000Z');
  });
});

const a = (
  id: string,
  date: string,
  start_time: string,
  end_time: string,
  title: string,
  notify = true,
  split_group_id: string | null = null,
) => ({ id, date, start_time, end_time, title, notify, split_group_id });

describe('qué avisos programar', () => {
  const now = new Date('2026-11-09T12:00:00Z'); // lunes 13:00 en Madrid
  const acts = [
    a('cena', '2026-11-09', '21:30', '22:30', 'Cena'),
    a('casa', '2026-11-09', '13:30', '14:00', 'Casa y recados'),
    a('instr', '2026-11-09', '12:30', '13:30', 'Practicar instrumento'), // ya empezó
    a('comida', '2026-11-09', '14:00', '16:00', 'Comida y descanso'),
    a('dormir', '2026-11-10', '00:30', '09:00', 'Dormir', false),
    a('desayuno', '2026-11-10', '09:00', '09:30', 'Despertar y desayuno'),
  ];

  test('solo futuras, con aviso, en orden y con «Siguiente»', () => {
    const plan = planActivityNotifications(acts, now);
    expect(plan.map((p) => `${p.at.toISOString()} ${p.title} | ${p.body}`)).toEqual([
      '2026-11-09T12:30:00.000Z Casa y recados | Hasta las 14:00 · Siguiente: Comida y descanso',
      '2026-11-09T13:00:00.000Z Comida y descanso | Hasta las 16:00 · Siguiente: Cena',
      '2026-11-09T20:30:00.000Z Cena | Hasta las 22:30 · Siguiente: Dormir',
      '2026-11-10T08:00:00.000Z Despertar y desayuno | Hasta las 09:30',
    ]);
    expect(plan[0].id).toBe('act:casa');
  });

  test('actividad que cruza medianoche: un solo aviso y fin real', () => {
    const plan = planActivityNotifications(
      [
        a('p1', '2026-11-09', '23:00', '24:00', 'Peli', true, 'g'),
        a('p2', '2026-11-10', '00:00', '01:00', 'Peli', true, 'g'),
        a('x', '2026-11-10', '09:00', '10:00', 'Desayuno'),
      ],
      now,
    );
    expect(plan.map((p) => `${p.title} | ${p.body}`)).toEqual([
      'Peli | Hasta las 00:00 · Siguiente: Desayuno',
      'Desayuno | Hasta las 10:00',
    ]);
  });

  test('día de la semana para expo (1 = domingo)', () => {
    expect(toExpoWeekday(7)).toBe(1); // domingo
    expect(toExpoWeekday(1)).toBe(2); // lunes
    expect(toExpoWeekday(6)).toBe(7); // sábado
  });
});
