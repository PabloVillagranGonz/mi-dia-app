import { createMockStore } from '../mock/store';
import { CATEGORY_IDS } from '../mock/seed';
import { createRepository, type ActivityInput } from '../repository';
import type { DayActivity } from '../types';

const MON = '2026-11-09';
const TUE = '2026-11-10';
const SUN = '2026-11-15';
const NEXT_MON = '2026-11-16';

function setup(today = MON) {
  const store = createMockStore();
  const repo = createRepository(store, () => today);
  return { store, repo };
}

const input = (title: string, start_time: string, end_time: string, extra: Partial<ActivityInput> = {}): ActivityInput => ({
  title,
  start_time,
  end_time,
  category_id: CATEGORY_IDS.personal,
  kind: 'task',
  notify: true,
  ...extra,
});

const summary = (list: DayActivity[]) =>
  [...list].sort((a, b) => a.start_time.localeCompare(b.start_time)).map((a) => `${a.start_time}-${a.end_time} ${a.title}`);

describe('repositorio', () => {
  test('ensureWeek genera la semana una sola vez', async () => {
    const { repo } = setup();
    const w1 = await repo.ensureWeek(MON);
    const w2 = await repo.ensureWeek(MON);
    expect(w1.id).toBe(w2.id);
    expect(w1.source).toBe('auto');
    expect(await repo.getDay(MON)).toHaveLength(10);
  });

  test('avisa a los suscriptores al cambiar algo', async () => {
    const { repo } = setup();
    const spy = jest.fn();
    repo.subscribe(spy);
    await repo.ensureWeek(MON);
    expect(spy).toHaveBeenCalled();
  });

  test('marcar hecho solo hoy', async () => {
    const { repo } = setup(MON);
    await repo.ensureWeek(MON);
    const [today] = await repo.getDay(MON);
    await repo.toggleDone(today.id);
    expect((await repo.getDay(MON)).find((a) => a.id === today.id)!.done).toBe(true);

    const [tomorrow] = await repo.getDay(TUE);
    await expect(repo.toggleDone(tomorrow.id)).rejects.toThrow('Solo puedes marcar como hechas');
  });

  test('días pasados en solo lectura', async () => {
    const { repo } = setup(TUE);
    await repo.ensureWeek(MON);
    const [yesterday] = await repo.getDay(MON);
    await expect(repo.setNote(yesterday.id, 'hola')).rejects.toThrow('solo lectura');
  });

  test('evento: recorta la rutina del día', async () => {
    const { repo } = setup();
    await repo.ensureWeek(MON);
    await repo.addEvent(MON, input('Ensayo charanga', '19:00', '22:00'));
    expect(summary(await repo.getDay(MON)).slice(-4)).toEqual([
      '16:00-18:00 Practicar instrumento',
      '18:00-19:00 Programar / proyectos',
      '19:00-22:00 Ensayo charanga',
      '22:00-22:30 Cena',
    ]);
  });

  test('evento que cruza la medianoche del domingo crea la semana siguiente y recorta su lunes', async () => {
    const { repo } = setup();
    await repo.ensureWeek(MON);
    await repo.addEvent(SUN, input('Bolo', '22:00', '01:00'));
    expect(summary(await repo.getDay(SUN))).toEqual(['22:00-24:00 Bolo']);
    const monday = summary(await repo.getDay(NEXT_MON));
    expect(monday.slice(0, 2)).toEqual(['00:00-01:00 Bolo', '01:00-09:00 Dormir']);
  });

  test('dos eventos solapados: error claro', async () => {
    const { repo } = setup();
    await repo.ensureWeek(MON);
    await repo.addEvent(MON, input('Ensayo', '19:00', '21:00'));
    await expect(repo.addEvent(MON, input('Bolo', '20:00', '23:00'))).rejects.toThrow('Se solapa con «Ensayo» (19:00–21:00).');
  });

  test('actividad manual que se solapa: error', async () => {
    const { repo } = setup();
    await repo.ensureWeek(MON);
    await expect(repo.addManual(MON, input('Leer', '21:00', '22:00'))).rejects.toThrow('Se solapa con «Cena»');
    await repo.addManual(MON, input('Leer', '22:30', '23:30'));
    expect(summary(await repo.getDay(MON))).toContain('22:30-23:30 Leer');
  });

  test('editar una actividad de plantilla la marca como editada; aplicar la rutina la respeta', async () => {
    const { repo } = setup(MON);
    await repo.ensureWeek(MON);
    const cenaMartes = (await repo.getDay(TUE)).find((a) => a.title === 'Cena')!;
    await repo.updateActivity(cenaMartes.id, input('Cena', '22:00', '23:00', { kind: 'fixed', category_id: CATEGORY_IDS.salud }));

    const conservatorio = (await repo.getTemplates()).find((t) => t.weekday === 2 && t.title === 'Conservatorio')!;
    await repo.saveTemplate(
      { ...input('Conservatorio', '16:00', '21:00', { category_id: CATEGORY_IDS.musica }), weekday: 2 },
      conservatorio.id,
    );
    await repo.applyTemplateToCurrentWeek();

    expect(summary(await repo.getDay(TUE)).slice(-2)).toEqual(['16:00-21:00 Conservatorio', '22:00-23:00 Cena']);
  });

  test('rutina base: cruzar medianoche crea dos filas enlazadas; borrar una borra las dos', async () => {
    const { repo } = setup();
    await repo.saveTemplate({ ...input('Estudiar', '23:00', '00:30'), weekday: 7 });
    const rows = (await repo.getTemplates()).filter((t) => t.title === 'Estudiar');
    expect(rows.map((r) => `${r.weekday} ${r.start_time}-${r.end_time}`).sort()).toEqual(['1 00:00-00:30', '7 23:00-24:00']);
    expect(rows[0].split_group_id).toBeTruthy();
    expect(rows[0].split_group_id).toBe(rows[1].split_group_id);

    await repo.deleteTemplate(rows[0].id);
    expect((await repo.getTemplates()).filter((t) => t.title === 'Estudiar')).toEqual([]);
  });

  test('rutina base: solape con el día siguiente', async () => {
    const { repo } = setup();
    await expect(repo.saveTemplate({ ...input('Tarde', '23:00', '01:00'), weekday: 1 })).rejects.toThrow(
      'Se solapa con «Dormir» (00:30–09:00).',
    );
  });

  test('copiar el lunes al sábado sustituye el sábado', async () => {
    const { repo } = setup();
    await repo.copyTemplateDay(1, [6]);
    expect((await repo.getTemplates()).filter((t) => t.weekday === 6)).toHaveLength(10);
  });

  test('planificar la semana siguiente copiando la actual conserva sus eventos ya puestos', async () => {
    const { repo } = setup(SUN);
    await repo.ensureWeek(MON);
    await repo.addEvent(NEXT_MON, input('Médico', '10:00', '11:00'));
    await repo.planWeek(NEXT_MON, 'copy');
    const day = summary(await repo.getDay(NEXT_MON));
    expect(day.slice(2, 5)).toEqual(['09:30-10:00 Deporte', '10:00-11:00 Médico', '11:00-12:30 Programar / proyectos']);
    expect((await repo.getWeek(NEXT_MON))!.source).toBe('copy');
  });

  test('borrar una mitad de medianoche borra la otra; restaurar día devuelve la rutina', async () => {
    const { repo } = setup();
    await repo.ensureWeek(MON);
    await repo.addManual(MON, input('Peli', '23:00', '00:15'));
    const peli = (await repo.getDay(MON)).find((a) => a.title === 'Peli')!;
    await repo.deleteActivity(peli.id);
    expect((await repo.getDay(TUE)).find((a) => a.title === 'Peli')).toBeUndefined();

    const deporte = (await repo.getDay(TUE)).find((a) => a.title === 'Deporte')!;
    await repo.deleteActivity(deporte.id);
    await repo.restoreDay(TUE);
    expect((await repo.getDay(TUE)).find((a) => a.title === 'Deporte')).toBeDefined();
  });

  test('borrar la planificación de una semana futura; la actual no', async () => {
    const { repo } = setup(SUN);
    await repo.ensureWeek(MON);
    await repo.planWeek(NEXT_MON, 'copy');
    await repo.deleteWeek(NEXT_MON);
    expect(await repo.getWeek(NEXT_MON)).toBeNull();
    expect(await repo.getDay(NEXT_MON)).toEqual([]);
    await expect(repo.deleteWeek(MON)).rejects.toThrow('Solo se pueden borrar semanas futuras.');
  });
});
