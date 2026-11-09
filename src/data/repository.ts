// Repositorio: lo único que usan las pantallas. Aplica las reglas de negocio (src/domain/)
// sobre un Store (mock o Supabase) y avisa de los cambios para que las vistas se refresquen.

import { localNow } from '@/domain/clock';
import { planEvent } from '@/domain/events';
import type { Slot } from '@/domain/intervals';
import { splitAtMidnight } from '@/domain/midnight';
import { copyDayRows, linkedIds, templateConflicts, templateRows } from '@/domain/template';
import { addDays, compareDates, weekDates, weekStartOf } from '@/domain/time';
import { validateNoOverlap, validationMessage } from '@/domain/validation';
import {
  generateFromPreviousWeek,
  generateFromTemplate,
  planApplyTemplateForDates,
  trimAround,
  type DayActivityDraft,
} from '@/domain/week';
import { uuid } from '@/lib/uuid';
import { UserError } from './errors';
import type { DayChanges, NewCategory, SettingsPatch, Store } from './store';
import type {
  ActivityKind,
  Category,
  DayActivity,
  HHMM,
  ISODate,
  Settings,
  TemplateActivity,
  Week,
  Weekday,
} from './types';

export interface ActivityInput {
  title: string;
  start_time: HHMM;
  /** Si es menor que start_time, cruza medianoche y se parte en dos. */
  end_time: HHMM;
  category_id: string | null;
  kind: ActivityKind;
  notify: boolean;
}

export interface TemplateInput extends ActivityInput {
  weekday: Weekday;
}

type Listener = () => void;

export function createRepository(store: Store, today: () => ISODate = () => localNow().date) {
  const listeners = new Set<Listener>();
  const changed = () => listeners.forEach((l) => l());

  function requireTitle(title: string) {
    if (!title.trim()) throw new UserError('Ponle un nombre a la actividad.');
  }

  function overlapError(conflicts: Array<Slot & { title: string }>): never {
    throw new UserError(validationMessage({ ok: false, reason: 'overlap', conflicts }) ?? 'Se solapa con otra actividad.');
  }

  // ── Semanas ───────────────────────────────────────────────────

  /** Devuelve la semana; si no existe la genera desde la rutina base. */
  async function ensureWeek(weekStart: ISODate, source: Week['source'] = 'auto'): Promise<Week> {
    const existing = await store.getWeek(weekStart);
    if (existing) return existing;
    const templates = await store.listTemplates();
    const week = await store.insertWeek(weekStart, source);
    // Si otra apertura la creó a la vez, ya tendrá actividades: no duplicar.
    const already = await store.listDayActivities(weekStart, addDays(weekStart, 6));
    if (already.length === 0) {
      await store.insertDayActivities(generateFromTemplate(weekStart, templates).map((d) => ({ ...d, week_id: week.id })));
    }
    changed();
    return week;
  }

  async function weekIdFor(date: ISODate): Promise<string> {
    return (await ensureWeek(weekStartOf(date))).id;
  }

  /**
   * Planificación dominical: (re)genera la semana desde la base o copiando la anterior.
   * Conserva los eventos que ya hubiera y recorta lo generado a su alrededor.
   */
  async function planWeek(weekStart: ISODate, mode: 'base' | 'copy'): Promise<void> {
    const end = addDays(weekStart, 6);
    const templates = await store.listTemplates();
    const week = (await store.getWeek(weekStart)) ?? (await store.insertWeek(weekStart, mode));
    const current = await store.listDayActivities(weekStart, end);
    const events = current.filter((a) => a.origin === 'event');

    let drafts: DayActivityDraft[];
    if (mode === 'copy') {
      const prevStart = addDays(weekStart, -7);
      const prev = await store.listDayActivities(prevStart, addDays(prevStart, 6));
      drafts = generateFromPreviousWeek(weekStart, prev, templates);
    } else {
      drafts = generateFromTemplate(weekStart, templates);
    }
    const trimmed = weekDates(weekStart).flatMap((date) =>
      trimAround(
        drafts.filter((d) => d.date === date),
        events.filter((e) => e.date === date),
      ),
    );

    await store.applyDayChanges({
      delete: current.filter((a) => a.origin !== 'event').map((a) => a.id),
      update: [],
      insert: trimmed.map((d) => ({ ...d, week_id: week.id })),
    });
    await store.updateWeek(week.id, { source: mode });
    changed();
  }

  /**
   * Borra la planificación de una semana FUTURA (actividades, eventos y notas incluidos).
   * La semana actual no se puede borrar: se regeneraría sola al abrir la app.
   */
  async function deleteWeek(weekStart: ISODate): Promise<void> {
    if (compareDates(weekStart, weekStartOf(today())) <= 0) {
      throw new UserError('Solo se pueden borrar semanas futuras.');
    }
    const week = await store.getWeek(weekStart);
    if (!week) return;
    await store.deleteWeek(week.id);
    changed();
  }

  // ── Días ──────────────────────────────────────────────────────

  async function getDay(date: ISODate): Promise<DayActivity[]> {
    return store.listDayActivities(date, date);
  }

  async function getRange(from: ISODate, to: ISODate): Promise<DayActivity[]> {
    return store.listDayActivities(from, to);
  }

  async function toggleDone(id: string): Promise<void> {
    const a = await store.getDayActivity(id);
    if (!a) return;
    if (a.date !== today()) throw new UserError('Solo puedes marcar como hechas las actividades de hoy.');
    const done = !a.done;
    await store.updateDayActivity(id, { done, done_at: done ? new Date().toISOString() : null });
    changed();
  }

  async function setNote(id: string, note: string): Promise<void> {
    const a = await store.getDayActivity(id);
    if (!a) return;
    if (compareDates(a.date, today()) < 0) throw new UserError('Los días pasados son de solo lectura.');
    await store.updateDayActivity(id, { note: note.trim() ? note.trim() : null });
    changed();
  }

  /** Comprueba solapes de los trozos (tras partir en medianoche) contra lo que hay en cada día. */
  async function piecesFor(date: ISODate, input: Slot) {
    let split;
    try {
      split = splitAtMidnight(input.start_time, input.end_time);
    } catch {
      throw new UserError('La hora de fin debe ser distinta de la de inicio.');
    }
    const pieces = split.map((p) => ({
      date: addDays(date, p.dayOffset),
      start_time: p.start_time,
      end_time: p.end_time,
    }));
    // Generar antes las semanas implicadas para validar contra lo que de verdad habrá
    for (const p of pieces) await weekIdFor(p.date);
    const dayLists = await store.listDayActivities(date, pieces[pieces.length - 1].date);
    return { pieces, dayLists };
  }

  function assertNoOverlap(
    pieces: Array<{ date: ISODate } & Slot>,
    dayLists: DayActivity[],
    ignoreIds: string[],
  ) {
    for (const p of pieces) {
      const r = validateNoOverlap(p, dayLists.filter((a) => a.date === p.date), ignoreIds);
      if (!r.ok && r.reason === 'overlap') overlapError(r.conflicts);
      if (!r.ok) throw new UserError(validationMessage(r) ?? 'Horario no válido.');
    }
  }

  function draftOf(input: ActivityInput, date: ISODate, slot: Slot, origin: DayActivity['origin'], group: string | null): DayActivityDraft {
    return {
      date,
      start_time: slot.start_time,
      end_time: slot.end_time,
      title: input.title.trim(),
      category_id: input.category_id,
      kind: input.kind,
      origin,
      template_activity_id: null,
      split_group_id: group,
      notify: input.notify,
      edited: false,
      done: false,
      done_at: null,
      note: null,
    };
  }

  /** Actividad manual (no recorta nada: si se solapa, error). */
  async function addManual(date: ISODate, input: ActivityInput): Promise<void> {
    requireTitle(input.title);
    if (compareDates(date, today()) < 0) throw new UserError('Los días pasados son de solo lectura.');
    const { pieces, dayLists } = await piecesFor(date, input);
    assertNoOverlap(pieces, dayLists, []);
    const group = pieces.length > 1 ? uuid() : null;
    const rows = await Promise.all(
      pieces.map(async (p) => ({ ...draftOf(input, p.date, p, 'manual', group), week_id: await weekIdFor(p.date) })),
    );
    await store.insertDayActivities(rows);
    changed();
  }

  /** Evento puntual: recorta, parte o elimina lo que pise (spec §4.2). */
  async function addEvent(date: ISODate, input: ActivityInput): Promise<void> {
    requireTitle(input.title);
    if (compareDates(date, today()) < 0) throw new UserError('Los días pasados son de solo lectura.');
    const { pieces, dayLists } = await piecesFor(date, input);

    // Validar todos los trozos antes de escribir nada
    const plans = pieces.map((p) => {
      const r = planEvent(dayLists.filter((a) => a.date === p.date), p);
      if (!r.ok) overlapError(r.conflicts as unknown as DayActivity[]);
      return { piece: p, plan: r.plan };
    });

    const group = pieces.length > 1 ? uuid() : null;
    const changes: DayChanges = { delete: [], update: [], insert: [] };
    for (const { piece, plan } of plans) {
      const weekId = await weekIdFor(piece.date);
      changes.delete.push(...plan.toDelete);
      changes.update.push(...plan.toUpdate);
      for (const p of plan.toInsert) {
        const { user_id: _u, ...draft } = p as unknown as DayActivity;
        changes.insert.push({ ...draft, week_id: weekId });
      }
      changes.insert.push({ ...draftOf(input, piece.date, piece, 'event', group), week_id: weekId });
    }
    // Todo en una transacción: si falla, el día no queda a medias
    await store.applyDayChanges(changes);
    changed();
  }

  /**
   * Editar una actividad de un día (título, horario, categoría, tipo, aviso).
   * Si es de plantilla y cambia, queda `edited` para que «aplicar rutina» la respete.
   */
  async function updateActivity(id: string, input: ActivityInput): Promise<void> {
    requireTitle(input.title);
    const a = await store.getDayActivity(id);
    if (!a) return;
    if (compareDates(a.date, today()) < 0) throw new UserError('Los días pasados son de solo lectura.');

    const { pieces, dayLists } = await piecesFor(a.date, input);
    const own = linkedIds(a, dayLists);
    assertNoOverlap(pieces, dayLists, own);

    const touched =
      a.title !== input.title.trim() ||
      a.start_time !== input.start_time ||
      a.end_time !== input.end_time ||
      a.category_id !== input.category_id ||
      a.kind !== input.kind;
    const edited = a.edited || (a.origin === 'template' && touched);

    // Quitar la otra mitad si la había; la primera se actualiza en su sitio (conserva hecho y nota)
    await store.deleteDayActivities(own.filter((x) => x !== id));
    const group = pieces.length > 1 ? (a.split_group_id ?? uuid()) : null;
    await store.updateDayActivity(id, {
      title: input.title.trim(),
      start_time: pieces[0].start_time,
      end_time: pieces[0].end_time,
      category_id: input.category_id,
      kind: input.kind,
      notify: input.notify,
      split_group_id: group,
      edited,
    });
    if (pieces[1]) {
      await store.insertDayActivities([
        { ...draftOf(input, pieces[1].date, pieces[1], a.origin, group), edited, week_id: await weekIdFor(pieces[1].date) },
      ]);
    }
    changed();
  }

  /** Borra una actividad del día (y su otra mitad si cruza medianoche). El hueco queda libre. */
  async function deleteActivity(id: string): Promise<void> {
    const a = await store.getDayActivity(id);
    if (!a) return;
    if (compareDates(a.date, today()) < 0) throw new UserError('Los días pasados son de solo lectura.');
    const around = await store.listDayActivities(addDays(a.date, -1), addDays(a.date, 1));
    await store.deleteDayActivities(linkedIds(a, around));
    changed();
  }

  /** «Restaurar rutina de este día»: vuelve a poner la plantilla alrededor de eventos, manuales y editadas. */
  async function restoreDay(date: ISODate): Promise<void> {
    if (compareDates(date, today()) < 0) throw new UserError('Los días pasados son de solo lectura.');
    const [templates, day] = await Promise.all([store.listTemplates(), store.listDayActivities(date, date)]);
    const plan = planApplyTemplateForDates(day, templates, [date]);
    const weekId = await weekIdFor(date);
    await store.applyDayChanges({ delete: plan.toDelete, update: [], insert: plan.toInsert.map((d) => ({ ...d, week_id: weekId })) });
    changed();
  }

  // ── Rutina base ───────────────────────────────────────────────

  async function getTemplates(): Promise<TemplateActivity[]> {
    return store.listTemplates();
  }

  /** Crea o edita una actividad de la rutina base. Parte en medianoche y valida solapes. */
  async function saveTemplate(input: TemplateInput, editingId?: string): Promise<void> {
    requireTitle(input.title);
    let rows;
    try {
      rows = templateRows(input);
    } catch {
      throw new UserError('La hora de fin debe ser distinta de la de inicio.');
    }
    const all = await store.listTemplates();
    const editing = editingId ? all.find((t) => t.id === editingId) : undefined;
    const own = editing ? linkedIds(editing, all) : [];
    const conflicts = templateConflicts(rows, all, own);
    if (conflicts.length) overlapError(conflicts);

    const group = rows.length > 1 ? (editing?.split_group_id ?? uuid()) : null;
    const base = {
      title: input.title.trim(),
      category_id: input.category_id,
      kind: input.kind,
      notify: input.notify,
      split_group_id: group,
    };

    if (editing && own.length === rows.length) {
      // Mismo número de filas: actualizar en su sitio para no romper los enlaces de los días ya generados
      const ownRows = all.filter((t) => own.includes(t.id)).sort((x, y) => (x.end_time === '24:00' ? 0 : 1) - (y.end_time === '24:00' ? 0 : 1)); // primera mitad, luego segunda
      await Promise.all(ownRows.map((t, i) => store.updateTemplate(t.id, { ...base, ...rows[i] })));
    } else {
      if (own.length) await store.deleteTemplates(own);
      await store.insertTemplates(rows.map((r) => ({ ...base, ...r })));
    }
    changed();
  }

  async function deleteTemplate(id: string): Promise<void> {
    const all = await store.listTemplates();
    const t = all.find((x) => x.id === id);
    if (!t) return;
    await store.deleteTemplates(linkedIds(t, all));
    changed();
  }

  /** «Copiar este día a…»: sustituye el contenido de los días destino. */
  async function copyTemplateDay(from: Weekday, to: Weekday[]): Promise<void> {
    const all = await store.listTemplates();
    const targets = to.filter((w) => w !== from);
    await store.deleteTemplates(all.filter((t) => targets.includes(t.weekday)).map((t) => t.id));
    await store.insertTemplates(copyDayRows(all, from, targets));
    changed();
  }

  /**
   * Tras guardar la rutina base: «También el resto de esta semana».
   * Afecta desde mañana hasta el domingo, y a la semana siguiente si ya está planificada.
   */
  async function applyTemplateToCurrentWeek(): Promise<void> {
    const t = today();
    const weekStart = weekStartOf(t);
    const nextStart = addDays(weekStart, 7);
    const dates = weekDates(weekStart).filter((d) => compareDates(d, t) > 0);
    if (await store.getWeek(nextStart)) dates.push(...weekDates(nextStart));
    if (!dates.length) return;

    const [templates, acts] = await Promise.all([
      store.listTemplates(),
      store.listDayActivities(dates[0], dates[dates.length - 1]),
    ]);
    const plan = planApplyTemplateForDates(acts, templates, dates);
    const weekIds = new Map<string, string>();
    for (const d of new Set(plan.toInsert.map((x) => weekStartOf(x.date)))) weekIds.set(d, (await ensureWeek(d)).id);
    await store.applyDayChanges({
      delete: plan.toDelete,
      update: [],
      insert: plan.toInsert.map((d) => ({ ...d, week_id: weekIds.get(weekStartOf(d.date))! })),
    });
    changed();
  }

  // ── Categorías y ajustes ──────────────────────────────────────

  const getCategories = (): Promise<Category[]> => store.listCategories();

  async function saveCategory(c: NewCategory, id?: string): Promise<void> {
    if (!c.name.trim()) throw new UserError('Ponle un nombre a la categoría.');
    if (id) await store.updateCategory(id, { ...c, name: c.name.trim() });
    else await store.insertCategory({ ...c, name: c.name.trim() });
    changed();
  }

  async function deleteCategory(id: string): Promise<void> {
    await store.deleteCategory(id);
    changed();
  }

  const getSettings = (): Promise<Settings> => store.getSettings();

  async function updateSettings(patch: SettingsPatch): Promise<void> {
    await store.updateSettings(patch);
    changed();
  }

  return {
    subscribe(l: Listener) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    // semanas
    ensureWeek,
    getWeek: (weekStart: ISODate) => store.getWeek(weekStart),
    planWeek,
    deleteWeek,
    // días
    getDay,
    getRange,
    toggleDone,
    setNote,
    addManual,
    addEvent,
    updateActivity,
    deleteActivity,
    restoreDay,
    // rutina base
    getTemplates,
    saveTemplate,
    deleteTemplate,
    copyTemplateDay,
    applyTemplateToCurrentWeek,
    // categorías y ajustes
    getCategories,
    saveCategory,
    deleteCategory,
    getSettings,
    updateSettings,
  };
}

export type Repository = ReturnType<typeof createRepository>;
