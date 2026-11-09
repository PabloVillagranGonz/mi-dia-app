import { dayAccomplished, userStats } from '../stats';

const act = (date: string, done: boolean, kind: 'task' | 'fixed' = 'task', category_id: string | null = 'c', start = '10:00', end = '11:00') => ({
  date,
  start_time: start,
  end_time: end,
  kind,
  done,
  category_id,
});

/** Un día con `n` tareas de las que `d` están hechas. */
const day = (date: string, n: number, d: number) => Array.from({ length: n }, (_, i) => act(date, i < d));

describe('estadísticas', () => {
  test('un día está cumplido con la mitad de las tareas; las fijas no cuentan', () => {
    expect(dayAccomplished(day('2026-11-09', 4, 2))).toBe(true);
    expect(dayAccomplished(day('2026-11-09', 4, 1))).toBe(false);
    expect(dayAccomplished([act('2026-11-09', true, 'fixed')])).toBe(false); // sin tareas
  });

  test('racha: cuenta hacia atrás desde ayer; hoy suma solo si ya está cumplido', () => {
    const acts = [...day('2026-11-05', 2, 0), ...day('2026-11-06', 2, 2), ...day('2026-11-07', 2, 1), ...day('2026-11-08', 2, 2), ...day('2026-11-09', 2, 0)];
    expect(userStats(acts, '2026-11-09').streak).toBe(3); // 6, 7 y 8; hoy (9) aún a medias
    const hoyCumplido = [...acts.filter((a) => a.date !== '2026-11-09'), ...day('2026-11-09', 2, 1)];
    expect(userStats(hoyCumplido, '2026-11-09').streak).toBe(4);
  });

  test('un día sin cumplir corta la racha; la mejor racha se guarda', () => {
    const acts = [
      ...day('2026-11-01', 1, 1),
      ...day('2026-11-02', 1, 1),
      ...day('2026-11-03', 1, 1),
      ...day('2026-11-04', 1, 0),
      ...day('2026-11-08', 1, 1),
    ];
    const s = userStats(acts, '2026-11-09');
    expect(s.streak).toBe(1);
    expect(s.bestStreak).toBe(3);
  });

  test('días saltados (sin actividades) cortan la mejor racha', () => {
    const acts = [...day('2026-11-01', 1, 1), ...day('2026-11-03', 1, 1)];
    expect(userStats(acts, '2026-11-09').bestStreak).toBe(1);
  });

  test('progreso por semana (lunes a domingo), de la más reciente a la más antigua; el futuro no cuenta', () => {
    const acts = [...day('2026-11-02', 4, 3), ...day('2026-11-08', 2, 1), ...day('2026-11-09', 2, 2), ...day('2026-11-12', 5, 0)];
    expect(userStats(acts, '2026-11-09').weeks).toEqual([
      { week_start: '2026-11-09', done: 2, total: 2, ratio: 1 },
      { week_start: '2026-11-02', done: 4, total: 6, ratio: 4 / 6 },
    ]);
  });

  test('minutos por categoría hasta hoy, incluidas las fijas, de más a menos; último día con algo hecho', () => {
    const acts = [
      act('2026-11-08', true, 'fixed', 'salud', '00:30', '09:00'),
      act('2026-11-08', true, 'task', 'musica', '16:00', '17:30'),
      act('2026-11-09', false, 'task', 'musica', '16:00', '17:00'),
      act('2026-11-10', true, 'task', 'musica', '16:00', '20:00'), // futuro
    ];
    const s = userStats(acts, '2026-11-09');
    expect(s.categories).toEqual([
      { category_id: 'salud', minutes: 510 },
      { category_id: 'musica', minutes: 150 },
    ]);
    expect(s.lastDoneDate).toBe('2026-11-08');
  });

  test('sin actividades: todo a cero', () => {
    expect(userStats([], '2026-11-09')).toEqual({ weeks: [], streak: 0, bestStreak: 0, categories: [], lastDoneDate: null });
  });
});
