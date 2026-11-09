import type { DayActivity } from '../../data/types';
import { seedTemplates } from '../../data/mock/seed';
import { progressOf } from '../progress';
import { generateFromPreviousWeek, generateFromTemplate, planApplyTemplate, type DayActivityDraft } from '../week';

const WEEK = '2026-11-09'; // lunes
const NEXT = '2026-11-16';

let seq = 0;
const persist = (drafts: DayActivityDraft[]): DayActivity[] =>
  drafts.map((d) => ({ ...d, id: `da-${++seq}`, user_id: 'u', week_id: 'w' }));

const summary = (list: Array<Pick<DayActivity, 'date' | 'start_time' | 'end_time' | 'title'>>, date: string) =>
  list
    .filter((a) => a.date === date)
    .sort((a, b) => a.start_time.localeCompare(b.start_time))
    .map((a) => `${a.start_time}-${a.end_time} ${a.title}`);

describe('generar desde la rutina base', () => {
  const week = generateFromTemplate(WEEK, seedTemplates);

  test('lunes: 10 actividades, 6 tareas', () => {
    const monday = week.filter((a) => a.date === '2026-11-09');
    expect(monday).toHaveLength(10);
    expect(progressOf(monday).total).toBe(6);
  });

  test('martes: conservatorio por la tarde', () => {
    expect(summary(week, '2026-11-10')).toContain('16:00-20:00 Conservatorio');
  });

  test('fin de semana vacío', () => {
    expect(week.filter((a) => a.date === '2026-11-14' || a.date === '2026-11-15')).toEqual([]);
  });

  test('todo nace sin hacer, sin nota y enlazado a su plantilla', () => {
    expect(week.every((a) => !a.done && a.note === null && !a.edited && a.origin === 'template')).toBe(true);
    expect(week.every((a) => a.template_activity_id)).toBe(true);
  });

  test('«Dormir» sin aviso, el resto con aviso', () => {
    expect(week.filter((a) => !a.notify).every((a) => a.title === 'Dormir')).toBe(true);
  });
});

describe('copiar la semana anterior', () => {
  const prev = persist(generateFromTemplate(WEEK, seedTemplates));
  const lunes = (title: string) => prev.find((a) => a.date === '2026-11-09' && a.title === title)!;

  // Semana pasada: hecho y nota en Deporte; cena editada a mano; actividad manual; evento que recortó la comida.
  Object.assign(lunes('Deporte'), { done: true, note: 'piernas' });
  Object.assign(lunes('Cena'), { start_time: '21:00', end_time: '22:00', edited: true });
  prev.push({ ...lunes('Deporte'), id: 'manual-1', origin: 'manual', title: 'Leer', start_time: '23:00', end_time: '24:00', template_activity_id: null, done: false, note: null });
  prev.push({ ...lunes('Deporte'), id: 'ev-1', origin: 'event', title: 'Médico', start_time: '15:00', end_time: '16:00', template_activity_id: null, done: false, note: null });
  Object.assign(lunes('Comida y descanso'), { end_time: '15:00' });

  const next = generateFromPreviousWeek(NEXT, prev, seedTemplates);

  test('copia la manual y la editada; regenera el resto desde la base; no copia el evento', () => {
    expect(summary(next, '2026-11-16')).toEqual([
      '00:30-09:00 Dormir',
      '09:00-09:30 Despertar y desayuno',
      '09:30-10:30 Deporte',
      '10:30-12:30 Programar / proyectos',
      '12:30-13:30 Practicar instrumento',
      '13:30-14:00 Casa y recados',
      '14:00-16:00 Comida y descanso', // restaurada entera
      '16:00-18:00 Practicar instrumento',
      '18:00-20:00 Programar / proyectos',
      '21:00-22:00 Cena', // edición conservada, sin duplicar la de la plantilla
      '23:00-24:00 Leer',
    ]);
  });

  test('nada hecho ni con nota', () => {
    expect(next.every((a) => !a.done && a.note === null && a.done_at === null)).toBe(true);
  });

  test('una edición que pisa otra actividad de plantilla la recorta', () => {
    const p = persist(generateFromTemplate(WEEK, seedTemplates));
    const deporte = p.find((a) => a.date === '2026-11-09' && a.title === 'Deporte')!;
    Object.assign(deporte, { start_time: '10:00', end_time: '11:00', edited: true });
    const n = generateFromPreviousWeek(NEXT, p, seedTemplates);
    expect(summary(n, '2026-11-16').slice(1, 4)).toEqual([
      '09:00-09:30 Despertar y desayuno',
      '10:00-11:00 Deporte',
      '11:00-12:30 Programar / proyectos',
    ]);
  });
});

describe('aplicar cambios de la rutina base al resto de la semana', () => {
  test('sustituye plantilla no editada desde mañana, conserva el resto y recorta alrededor', () => {
    const week = persist(generateFromTemplate(WEEK, seedTemplates));
    const martes = (t: string) => week.find((a) => a.date === '2026-11-10' && a.title === t)!;
    Object.assign(martes('Cena'), { start_time: '22:00', end_time: '23:00', edited: true });
    week.push({ ...martes('Cena'), id: 'ev', origin: 'event', title: 'Ensayo', start_time: '18:00', end_time: '20:00', edited: false, template_activity_id: null });
    Object.assign(martes('Conservatorio'), { end_time: '18:00' }); // ya recortado por el evento

    // Nueva rutina: el conservatorio del martes pasa a 17:00–21:00
    const templates = seedTemplates.map((t) =>
      t.weekday === 2 && t.title === 'Conservatorio' ? { ...t, start_time: '17:00', end_time: '21:00' } : t,
    );

    const plan = planApplyTemplate(week, templates, '2026-11-10');
    const deletedIds = new Set(plan.toDelete);
    const result = [...week.filter((a) => !deletedIds.has(a.id)), ...plan.toInsert];

    expect(summary(result, '2026-11-10').slice(6)).toEqual([
      '14:00-16:00 Comida y descanso',
      '17:00-18:00 Conservatorio',
      '18:00-20:00 Ensayo',
      '20:00-21:00 Conservatorio',
      '22:00-23:00 Cena',
    ]);
    // El lunes (hoy) no se toca
    expect(plan.toDelete.some((id) => week.find((a) => a.id === id)!.date === '2026-11-09')).toBe(false);
  });
});
