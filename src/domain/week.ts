// Generar semanas y aplicar cambios de la rutina base (spec §4.1 y §4.3).

import type { DayActivity, ISODate, TemplateActivity } from '@/data/types';
import { fromRange, subtractRanges, toRange, type Slot } from './intervals';
import { addDays, compareDates, weekDates, weekdayOf } from './time';

/** Actividad de un día aún sin guardar (sin id, usuario ni semana). */
export type DayActivityDraft = Omit<DayActivity, 'id' | 'user_id' | 'week_id'>;

type Kept = Pick<DayActivity, 'start_time' | 'end_time' | 'template_activity_id'>;

function draftFromTemplate(t: TemplateActivity, date: ISODate): DayActivityDraft {
  return {
    date,
    start_time: t.start_time,
    end_time: t.end_time,
    title: t.title,
    category_id: t.category_id,
    kind: t.kind,
    origin: 'template',
    template_activity_id: t.id,
    split_group_id: t.split_group_id,
    notify: t.notify,
    edited: false,
    done: false,
    done_at: null,
    note: null,
    external_id: null,
  };
}

/**
 * Rellena un día desde la rutina base respetando lo que ya hay (`kept`: eventos,
 * manuales y editadas): las plantillas ya representadas por una editada se omiten
 * y el resto se recorta alrededor de lo conservado.
 */
export function composeDay(
  date: ISODate,
  templates: readonly TemplateActivity[],
  kept: readonly Kept[],
): DayActivityDraft[] {
  const weekday = weekdayOf(date);
  const represented = new Set(kept.map((k) => k.template_activity_id).filter(Boolean));
  const blockers = kept.map(toRange);
  return templates
    .filter((t) => t.weekday === weekday && !represented.has(t.id))
    .flatMap((t) =>
      subtractRanges(toRange(t), blockers).map((r) => ({ ...draftFromTemplate(t, date), ...fromRange(r) })),
    );
}

/** Recorta cada elemento alrededor de los bloqueos (p. ej. eventos ya puestos en una semana que se replanifica). */
export function trimAround<T extends Slot>(items: readonly T[], blockers: readonly Slot[]): T[] {
  const cuts = blockers.map(toRange);
  return items.flatMap((it) => subtractRanges(toRange(it), cuts).map((r) => ({ ...it, ...fromRange(r) })));
}

/** Semana desde la rutina base. */
export function generateFromTemplate(weekStart: ISODate, templates: readonly TemplateActivity[]): DayActivityDraft[] {
  return weekDates(weekStart).flatMap((date) => composeDay(date, templates, []));
}

/**
 * Semana copiando la anterior (decisión 9-11-2026):
 * - copia +7 días las `manual` y las `template` editadas a mano (sin hecho ni nota);
 * - el resto se regenera desde la base, recortado alrededor de lo copiado;
 * - los eventos no se copian.
 */
export function generateFromPreviousWeek(
  weekStart: ISODate,
  previousWeek: readonly DayActivity[],
  templates: readonly TemplateActivity[],
): DayActivityDraft[] {
  const copied: DayActivityDraft[] = previousWeek
    .filter((a) => a.origin === 'manual' || (a.origin === 'template' && a.edited))
    .map(({ id: _id, user_id: _u, week_id: _w, ...a }) => ({
      ...a,
      date: addDays(a.date, 7),
      done: false,
      done_at: null,
      note: null,
    }));

  return weekDates(weekStart).flatMap((date) => {
    const keptToday = copied.filter((c) => c.date === date);
    return [...keptToday, ...composeDay(date, templates, keptToday)];
  });
}

export interface ApplyTemplatePlan {
  toDelete: string[];
  toInsert: DayActivityDraft[];
}

/**
 * Tras editar la rutina base y elegir «También el resto de esta semana»:
 * en los días a partir de `fromDate` (mañana), sustituye las actividades de plantilla
 * no editadas y conserva eventos, manuales y editadas, recortando la plantilla a su alrededor.
 */
export function planApplyTemplate(
  dayActivities: readonly DayActivity[],
  templates: readonly TemplateActivity[],
  fromDate: ISODate,
): ApplyTemplatePlan {
  const plan: ApplyTemplatePlan = { toDelete: [], toInsert: [] };
  const dates = [...new Set(dayActivities.map((a) => a.date))];
  return applyToDates(plan, dayActivities, templates, dates.filter((d) => compareDates(d, fromDate) >= 0));
}

/** Igual que `planApplyTemplate` pero para fechas concretas (incluye días que estén vacíos). */
export function planApplyTemplateForDates(
  dayActivities: readonly DayActivity[],
  templates: readonly TemplateActivity[],
  dates: readonly ISODate[],
): ApplyTemplatePlan {
  return applyToDates({ toDelete: [], toInsert: [] }, dayActivities, templates, dates);
}

function applyToDates(
  plan: ApplyTemplatePlan,
  dayActivities: readonly DayActivity[],
  templates: readonly TemplateActivity[],
  dates: readonly ISODate[],
): ApplyTemplatePlan {
  for (const date of dates) {
    const ofDay = dayActivities.filter((a) => a.date === date);
    const replaceable = ofDay.filter((a) => a.origin === 'template' && !a.edited);
    const kept = ofDay.filter((a) => !(a.origin === 'template' && !a.edited));
    plan.toDelete.push(...replaceable.map((a) => a.id));
    plan.toInsert.push(...composeDay(date, templates, kept));
  }
  return plan;
}
