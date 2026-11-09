import { progressLabel, progressOf } from '../progress';
import { buildTimeline, nowState } from '../timeline';
import { toMinutes } from '../time';

const a = (id: string, start_time: string, end_time: string) => ({ id, start_time, end_time });

const day = [a('desayuno', '09:00', '09:30'), a('dormir', '00:30', '09:00'), a('cena', '21:30', '22:30')];

describe('huecos (Tiempo libre)', () => {
  test('ordena y rellena de 00:00 a 24:00', () => {
    const t = buildTimeline(day).map((i) =>
      i.kind === 'gap' ? `hueco ${i.start_time}-${i.end_time}` : i.activity.id,
    );
    expect(t).toEqual(['hueco 00:00-00:30', 'dormir', 'desayuno', 'hueco 09:30-21:30', 'cena', 'hueco 22:30-24:00']);
  });

  test('día vacío (fin de semana) = un único hueco', () => {
    expect(buildTimeline([])).toEqual([{ kind: 'gap', start_time: '00:00', end_time: '24:00' }]);
  });

  test('día lleno sin huecos', () => {
    expect(buildTimeline([a('x', '00:00', '12:00'), a('y', '12:00', '24:00')]).every((i) => i.kind === 'activity')).toBe(
      true,
    );
  });
});

describe('AHORA', () => {
  test('dentro de una actividad', () => {
    const s = nowState(day, toMinutes('09:10'));
    expect(s.current?.id).toBe('desayuno');
    expect(s.minutesLeft).toBe(20);
    expect(s.next?.id).toBe('cena');
    expect(s.minutesToNext).toBe(toMinutes('21:30') - toMinutes('09:10'));
  });

  test('el fin es exclusivo: a las 09:30 ya no es desayuno', () => {
    const s = nowState(day, toMinutes('09:30'));
    expect(s.current).toBeNull();
    expect(s.gap).toEqual({ kind: 'gap', start_time: '09:30', end_time: '21:30' });
  });

  test('en un hueco: cuenta atrás hasta la siguiente', () => {
    const s = nowState(day, toMinutes('21:05'));
    expect(s.current).toBeNull();
    expect(s.next?.id).toBe('cena');
    expect(s.minutesToNext).toBe(25);
    expect(s.minutesLeft).toBe(25);
  });

  test('última hora: «Siguiente» es lo primero de mañana', () => {
    const s = nowState(day, toMinutes('23:00'), a('dormir-mañana', '00:30', '09:00'));
    expect(s.gap).toEqual({ kind: 'gap', start_time: '22:30', end_time: '24:00' });
    expect(s.next?.id).toBe('dormir-mañana');
    expect(s.minutesToNext).toBe(90);
    expect(s.minutesLeft).toBe(60);
  });

  test('sin nada más hoy ni mañana', () => {
    const s = nowState([], toMinutes('12:00'));
    expect(s.next).toBeNull();
    expect(s.minutesToNext).toBeNull();
  });
});

describe('progreso', () => {
  test('solo cuentan las tareas', () => {
    const p = progressOf([
      { kind: 'task', done: true },
      { kind: 'task', done: true },
      { kind: 'task', done: false },
      { kind: 'fixed', done: true },
      { kind: 'fixed', done: false },
    ]);
    expect(p).toEqual({ done: 2, total: 3, ratio: 2 / 3 });
    expect(progressLabel(p)).toBe('2 de 3 tareas hechas');
  });

  test('sin tareas', () => {
    const p = progressOf([{ kind: 'fixed', done: false }]);
    expect(p).toEqual({ done: 0, total: 0, ratio: 0 });
    expect(progressLabel(p)).toBe('Sin tareas hoy');
  });

  test('singular', () => {
    expect(progressLabel({ done: 1, total: 1, ratio: 1 })).toBe('1 de 1 tarea hecha');
  });
});
