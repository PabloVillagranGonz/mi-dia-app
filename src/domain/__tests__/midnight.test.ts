import { crossesMidnight, splitAtMidnight } from '../midnight';
import { copyDayRows, linkedIds, templateConflicts, templateRows } from '../template';
import { seedTemplates } from '../../data/mock/seed';

describe('partir en medianoche', () => {
  test('no cruza', () => {
    expect(splitAtMidnight('10:00', '12:00')).toEqual([{ dayOffset: 0, start_time: '10:00', end_time: '12:00' }]);
    expect(crossesMidnight('10:00', '12:00')).toBe(false);
  });

  test('cruza: dos trozos', () => {
    expect(splitAtMidnight('23:00', '01:30')).toEqual([
      { dayOffset: 0, start_time: '23:00', end_time: '24:00' },
      { dayOffset: 1, start_time: '00:00', end_time: '01:30' },
    ]);
    expect(crossesMidnight('23:00', '01:30')).toBe(true);
  });

  test('acabar justo a las 00:00 no parte', () => {
    expect(splitAtMidnight('22:30', '00:00')).toEqual([{ dayOffset: 0, start_time: '22:30', end_time: '24:00' }]);
    expect(splitAtMidnight('22:30', '24:00')).toEqual([{ dayOffset: 0, start_time: '22:30', end_time: '24:00' }]);
  });

  test('duración 0 es error', () => {
    expect(() => splitAtMidnight('10:00', '10:00')).toThrow();
  });
});

describe('rutina base', () => {
  test('domingo → lunes', () => {
    expect(templateRows({ weekday: 7, start_time: '23:00', end_time: '08:00' })).toEqual([
      { weekday: 7, start_time: '23:00', end_time: '24:00' },
      { weekday: 1, start_time: '00:00', end_time: '08:00' },
    ]);
  });

  test('una actividad que cruza medianoche choca con el «Dormir» del día siguiente', () => {
    // Martes 23:00 → 01:00 pisa el Dormir del miércoles (00:30–09:00)
    const rows = templateRows({ weekday: 2, start_time: '23:00', end_time: '01:00' });
    const conflicts = templateConflicts(rows, seedTemplates);
    expect(conflicts.map((c) => `${c.weekday} ${c.title}`)).toEqual(['3 Dormir']);
  });

  test('22:30–00:30 de lunes cabe (es el tiempo libre de la rutina)', () => {
    const rows = templateRows({ weekday: 1, start_time: '22:30', end_time: '00:30' });
    expect(templateConflicts(rows, seedTemplates)).toEqual([]);
  });

  test('editar ignora sus propias filas', () => {
    const cena = seedTemplates.find((t) => t.weekday === 1 && t.title === 'Cena')!;
    const rows = templateRows({ weekday: 1, start_time: '21:00', end_time: '22:30' });
    expect(templateConflicts(rows, seedTemplates, [cena.id])).toEqual([]);
  });

  test('linkedIds devuelve las dos mitades', () => {
    const all = [
      { id: 'a', split_group_id: 'g' },
      { id: 'b', split_group_id: 'g' },
      { id: 'c', split_group_id: null },
    ];
    expect(linkedIds(all[0], all)).toEqual(['a', 'b']);
    expect(linkedIds(all[2], all)).toEqual(['c']);
  });

  test('copiar el lunes al sábado', () => {
    const rows = copyDayRows(seedTemplates, 1, [1, 6]);
    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.weekday === 6)).toBe(true);
  });
});
