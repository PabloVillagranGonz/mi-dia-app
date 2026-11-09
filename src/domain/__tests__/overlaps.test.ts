import { slotsOverlap, subtractRange, subtractRanges } from '../intervals';
import { validateNoOverlap, validationMessage } from '../validation';

const a = (id: string, start_time: string, end_time: string) => ({ id, title: id, start_time, end_time });

describe('solapes', () => {
  test('tocarse no es solaparse', () => {
    expect(slotsOverlap(a('x', '10:00', '11:00'), a('y', '11:00', '12:00'))).toBe(false);
  });

  test('solape parcial, contenido y idéntico', () => {
    expect(slotsOverlap(a('x', '10:00', '11:00'), a('y', '10:59', '12:00'))).toBe(true);
    expect(slotsOverlap(a('x', '10:00', '14:00'), a('y', '11:00', '12:00'))).toBe(true);
    expect(slotsOverlap(a('x', '10:00', '11:00'), a('y', '10:00', '11:00'))).toBe(true);
  });

  test('validateNoOverlap detecta conflictos e ignora la propia actividad', () => {
    const day = [a('dormir', '00:30', '09:00'), a('desayuno', '09:00', '09:30'), a('cena', '21:30', '22:30')];
    expect(validateNoOverlap(a('n', '22:30', '24:00'), day)).toEqual({ ok: true });

    const r = validateNoOverlap(a('n', '08:00', '09:15'), day);
    expect(r.ok).toBe(false);
    if (!r.ok && r.reason === 'overlap') expect(r.conflicts.map((c) => c.id)).toEqual(['dormir', 'desayuno']);
    expect(validationMessage(r)).toBe('Se solapa con «dormir» (00:30–09:00) y 1 más.');

    expect(validateNoOverlap(a('cena', '21:00', '22:30'), day, ['cena'])).toEqual({ ok: true });
  });

  test('rango inválido', () => {
    const r = validateNoOverlap(a('n', '12:00', '12:00'), []);
    expect(r).toEqual({ ok: false, reason: 'invalid_range' });
    expect(validationMessage(r)).toMatch(/posterior/);
  });
});

describe('restar franjas', () => {
  test('0, 1 o 2 trozos', () => {
    expect(subtractRange({ start: 60, end: 120 }, { start: 0, end: 200 })).toEqual([]);
    expect(subtractRange({ start: 60, end: 120 }, { start: 100, end: 200 })).toEqual([{ start: 60, end: 100 }]);
    expect(subtractRange({ start: 60, end: 120 }, { start: 80, end: 90 })).toEqual([
      { start: 60, end: 80 },
      { start: 90, end: 120 },
    ]);
    expect(subtractRange({ start: 60, end: 120 }, { start: 120, end: 130 })).toEqual([{ start: 60, end: 120 }]);
  });

  test('varias a la vez', () => {
    expect(
      subtractRanges({ start: 0, end: 100 }, [
        { start: 10, end: 20 },
        { start: 50, end: 60 },
      ]),
    ).toEqual([
      { start: 0, end: 10 },
      { start: 20, end: 50 },
      { start: 60, end: 100 },
    ]);
  });
});
