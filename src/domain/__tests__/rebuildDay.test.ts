import type { DayChanges } from '../../data/store';
import type { DayActivity, TemplateActivity } from '../../data/types';
import type { GoogleCalendarConfig, GoogleEventRow } from '../googleEvents';
import { rebuildDay } from '../rebuildDay';

const DATE = '2026-11-11'; // miércoles
const WEEK = 'week-1';

const tpl = (id: string, start_time: string, end_time: string): TemplateActivity => ({
  id,
  user_id: 'u',
  weekday: 3,
  start_time,
  end_time,
  title: id,
  category_id: 'cat-rutina',
  kind: 'task',
  notify: true,
  split_group_id: null,
});

const TEMPLATES = [
  tpl('comida', '14:00', '16:00'),
  tpl('instrumento', '16:00', '17:30'),
  tpl('programar', '17:30', '19:00'),
  tpl('conservatorio', '19:30', '21:00'),
  tpl('cena', '21:30', '22:30'),
];

let n = 0;
const row = (over: Partial<DayActivity>): DayActivity => ({
  id: `r${++n}`,
  user_id: 'u',
  week_id: WEEK,
  date: DATE,
  start_time: '00:00',
  end_time: '01:00',
  title: 'x',
  category_id: null,
  kind: 'task',
  origin: 'template',
  template_activity_id: null,
  split_group_id: null,
  notify: true,
  edited: false,
  done: false,
  done_at: null,
  note: null,
  external_id: null,
  ...over,
});

/** El día tal como lo generó la rutina base. */
const routineDay = () =>
  TEMPLATES.map((t) =>
    row({ start_time: t.start_time, end_time: t.end_time, title: t.title, template_activity_id: t.id, category_id: t.category_id }),
  );

const CAL: GoogleCalendarConfig = { calendar_id: 'charanga', category_id: 'cat-musica', kind: 'task', notify: true };
const CAL2: GoogleCalendarConfig = { calendar_id: 'running', category_id: 'cat-salud', kind: 'task', notify: true };

const gev = (event_id: string, start_time: string, end_time: string, calendar_id = 'charanga', date = DATE): GoogleEventRow => ({
  calendar_id,
  event_id,
  date,
  start_time,
  end_time,
  title: `Ensayo ${event_id}`,
  updated: '2026-11-01T00:00:00Z',
});

/** Aplica los cambios en memoria (como haría apply_day_changes). */
function apply(existing: DayActivity[], ch: DayChanges): DayActivity[] {
  const upd = new Map(ch.update.map((u) => [u.id, u]));
  return [
    ...existing
      .filter((a) => !ch.delete.includes(a.id))
      .map((a) => (upd.has(a.id) ? { ...a, ...upd.get(a.id)! } : a)),
    ...ch.insert.map((i) => ({ ...i, id: `new${++n}`, user_id: 'u' })),
  ];
}

function run(existing: DayActivity[], events: GoogleEventRow[], calendars = [CAL, CAL2]) {
  const changes = rebuildDay({ date: DATE, weekId: WEEK, templates: TEMPLATES, existing, googleEvents: events, calendars });
  return { changes, day: apply(existing, changes) };
}

/** «título hh:mm–hh:mm» ordenado, para comparar días de un vistazo. */
const view = (day: DayActivity[]) =>
  [...day]
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((a) => `${a.title} ${a.start_time}–${a.end_time}`);

describe('rebuildDay', () => {
  test('un evento de Google recorta la rutina y entra con la categoría y el aviso de su calendario', () => {
    const { day } = run(routineDay(), [gev('a', '18:00', '20:00')]);
    expect(view(day)).toEqual([
      'comida 14:00–16:00',
      'instrumento 16:00–17:30',
      'programar 17:30–18:00',
      'Ensayo a 18:00–20:00',
      'conservatorio 20:00–21:00',
      'cena 21:30–22:30',
    ]);
    const g = day.find((a) => a.external_id)!;
    expect(g).toMatchObject({ external_id: 'gcal:charanga:a', origin: 'event', category_id: 'cat-musica', kind: 'task', notify: true });
    expect(g.week_id).toBe(WEEK);
  });

  test('sin cambios en Google → ningún cambio (idempotente)', () => {
    const first = run(routineDay(), [gev('a', '18:00', '20:00')]).day;
    const { changes } = run(first, [gev('a', '18:00', '20:00')]);
    expect(changes).toEqual({ delete: [], update: [], insert: [] });
  });

  test('mover el evento restaura la rutina del tramo que deja y recorta el nuevo', () => {
    const before = run(routineDay(), [gev('a', '18:00', '19:00')]).day;
    expect(view(before)).toContain('programar 17:30–18:00');
    const { day } = run(before, [gev('a', '19:00', '20:00')]);
    expect(view(day)).toEqual([
      'comida 14:00–16:00',
      'instrumento 16:00–17:30',
      'programar 17:30–19:00', // el trozo recortado vuelve a crecer (misma fila)
      'Ensayo a 19:00–20:00',
      'conservatorio 20:00–21:00',
      'cena 21:30–22:30',
    ]);
  });

  test('borrar el evento restaura la rutina entera, uniendo los trozos partidos', () => {
    const before = run(routineDay(), [gev('a', '14:30', '15:00')]).day;
    expect(view(before)).toEqual(expect.arrayContaining(['comida 14:00–14:30', 'comida 15:00–16:00']));
    const { day } = run(before, []);
    expect(view(day)).toEqual(view(routineDay()));
  });

  test('desactivar el calendario quita sus eventos y restaura la rutina', () => {
    const before = run(routineDay(), [gev('a', '16:00', '17:30')]).day;
    const { day } = run(before, [gev('a', '16:00', '17:30')], [CAL2]);
    expect(view(day)).toEqual(view(routineDay()));
  });

  test('lo borrado a mano fuera del tramo liberado no vuelve', () => {
    const day0 = routineDay().filter((a) => a.title !== 'cena'); // el usuario borró la cena
    const before = run(day0, [gev('a', '18:00', '19:00')]).day;
    const { day } = run(before, []);
    expect(view(day)).not.toContain('cena 21:30–22:30');
  });

  test('Google gana a un evento manual: lo recorta, o lo quita si lo cubre entero', () => {
    const manual = row({ origin: 'event', title: 'Dentista', start_time: '17:00', end_time: '18:30' });
    const tapado = row({ origin: 'event', title: 'Café', start_time: '19:00', end_time: '19:30' });
    const { day } = run([manual, tapado], [gev('a', '18:00', '20:00')]);
    expect(view(day)).toEqual(['Dentista 17:00–18:00', 'Ensayo a 18:00–20:00']);
  });

  test('dos eventos de Google solapados: el que empieza antes queda entero', () => {
    const { day } = run([], [gev('tarde', '18:30', '20:00', 'running'), gev('pronto', '18:00', '19:00')]);
    expect(view(day)).toEqual(['Ensayo pronto 18:00–19:00', 'Ensayo tarde 19:00–20:00']);
    expect(day.find((a) => a.title === 'Ensayo tarde')!.category_id).toBe('cat-salud');
  });

  test('un evento de Google tapado entero por otro no aparece', () => {
    const { day } = run([], [gev('grande', '18:00', '21:00'), gev('dentro', '19:00', '20:00', 'running')]);
    expect(view(day)).toEqual(['Ensayo grande 18:00–21:00']);
  });

  test('mover un evento hecho y con nota conserva hecho, hora de hecho y nota', () => {
    const before = run([], [gev('a', '18:00', '19:00')]).day.map((a) => ({
      ...a,
      done: true,
      done_at: '2026-11-11T17:30:00Z',
      note: 'Traer la trompeta',
    }));
    const { day, changes } = run(before, [gev('a', '19:00', '20:00')]);
    expect(changes.insert.filter((i) => i.external_id)).toEqual([]); // la fila del evento se mueve, no se recrea
    expect(day.find((a) => a.external_id)).toMatchObject({ start_time: '19:00', end_time: '20:00', done: true, done_at: '2026-11-11T17:30:00Z', note: 'Traer la trompeta' });
  });

  test('cambiar el título en Google sustituye la fila conservando hecho y nota', () => {
    const before = run([], [gev('a', '18:00', '19:00')]).day.map((a) => ({ ...a, done: true, note: 'ok' }));
    const { day } = run(before, [{ ...gev('a', '18:00', '19:00'), title: 'Ensayo general' }]);
    expect(day).toHaveLength(1);
    expect(day[0]).toMatchObject({ title: 'Ensayo general', done: true, note: 'ok' });
  });

  test('las filas editadas se respetan: se recortan pero su plantilla no se regenera', () => {
    const editada = row({ title: 'programar (corta)', template_activity_id: 'programar', edited: true, start_time: '17:30', end_time: '18:30' });
    const before = run([editada], [gev('a', '18:00', '19:00')]).day;
    expect(view(before)).toEqual(['programar (corta) 17:30–18:00', 'Ensayo a 18:00–19:00']);
    const { day } = run(before, []);
    // La editada no vuelve a crecer ni su plantilla reaparece en el hueco
    expect(view(day)).toEqual(['programar (corta) 17:30–18:00']);
  });

  test('evento que cruza medianoche: sus dos mitades comparten split_group_id', () => {
    const events = [gev('noche', '23:00', '24:00'), gev('noche', '00:00', '01:00', 'charanga', '2026-11-12')];
    const { day } = run([], events);
    expect(day[0].split_group_id).toMatch(/^[0-9a-f-]{36}$/);
    const single = run([], [gev('a', '18:00', '19:00')]).day;
    expect(single[0].split_group_id).toBeNull();
  });

  test('solo toca el día pedido', () => {
    const otro = row({ date: '2026-11-12', title: 'mañana', start_time: '18:00', end_time: '19:00' });
    const { changes } = run([otro], [gev('a', '18:00', '19:00')]);
    expect(changes.delete).toEqual([]);
    expect(changes.update).toEqual([]);
    expect(changes.insert).toHaveLength(1);
  });
});
