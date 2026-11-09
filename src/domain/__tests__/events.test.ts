import type { DayActivity } from '../../data/types';
import { applyEventPlan, planEvent } from '../events';

let n = 0;
const act = (id: string, start_time: string, end_time: string, origin: DayActivity['origin'] = 'template') =>
  ({ id, start_time, end_time, origin, title: id }) as Pick<DayActivity, 'id' | 'start_time' | 'end_time' | 'origin'> & {
    title: string;
  };

// Miércoles de la rutina (tarde)
const day = [
  act('comida', '14:00', '16:00'),
  act('instrumento', '16:00', '17:30'),
  act('programar', '17:30', '19:00'),
  act('conservatorio', '19:30', '21:00'),
  act('cena', '21:30', '22:30'),
];

describe('eventos puntuales', () => {
  test('cubre totalmente → se elimina', () => {
    const r = planEvent(day, { start_time: '16:00', end_time: '17:30' });
    expect(r.ok && r.plan).toEqual({ toDelete: ['instrumento'], toUpdate: [], toInsert: [] });
  });

  test('pisa por un extremo → se recorta', () => {
    const r = planEvent(day, { start_time: '18:30', end_time: '20:00' });
    expect(r.ok && r.plan.toUpdate).toEqual([
      { id: 'programar', start_time: '17:30', end_time: '18:30' },
      { id: 'conservatorio', start_time: '20:00', end_time: '21:00' },
    ]);
    expect(r.ok && r.plan.toDelete).toEqual([]);
  });

  test('cae en medio → se parte en dos', () => {
    const r = planEvent(day, { start_time: '14:30', end_time: '15:00' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan.toUpdate).toEqual([{ id: 'comida', start_time: '14:00', end_time: '14:30' }]);
    expect(r.plan.toInsert).toEqual([
      { start_time: '15:00', end_time: '16:00', origin: 'template', title: 'comida' },
    ]);
  });

  test('ensayo de 18:00 a 22:00: mezcla de todo', () => {
    const r = planEvent(day, { start_time: '18:00', end_time: '22:00' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const result = applyEventPlan(day, r.plan, () => `new-${++n}`);
    expect(result.map((a) => `${a.id} ${a.start_time}-${a.end_time}`)).toEqual([
      'comida 14:00-16:00',
      'instrumento 16:00-17:30',
      'programar 17:30-18:00',
      'cena 22:00-22:30',
    ]);
  });

  test('no toca lo que solo lo roza', () => {
    const r = planEvent(day, { start_time: '19:00', end_time: '19:30' });
    expect(r.ok && r.plan).toEqual({ toDelete: [], toUpdate: [], toInsert: [] });
  });

  test('dos eventos no pueden solaparse', () => {
    const withEvent = [...day, act('ensayo', '22:30', '24:00', 'event')];
    const r = planEvent(withEvent, { start_time: '23:00', end_time: '23:30' });
    expect(r).toEqual({ ok: false, reason: 'event_overlap', conflicts: [withEvent[5]] });
  });

  test('editar un evento no choca consigo mismo', () => {
    const withEvent = [...day, act('ensayo', '22:30', '24:00', 'event')];
    const r = planEvent(withEvent, { start_time: '22:30', end_time: '23:30' }, ['ensayo']);
    expect(r.ok).toBe(true);
  });
});
