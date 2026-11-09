// Operaciones básicas de lectura/escritura. Dos implementaciones:
// mock/store.ts (memoria) y supabase/store.ts. Las reglas de negocio viven en repository.ts.

import type { GoogleEventRow } from '@/domain/googleEvents';
import type { DayActivityDraft } from '@/domain/week';
import type { Category, DayActivity, GoogleCalendar, ISODate, Settings, TemplateActivity, Week, WeekSource } from './types';

export type NewCategory = Omit<Category, 'id' | 'user_id'>;
export type NewTemplate = Omit<TemplateActivity, 'id' | 'user_id'>;
export type NewDayActivity = DayActivityDraft & { week_id: string };

export interface DayChanges {
  delete: string[];
  update: { id: string; start_time: string; end_time: string }[];
  insert: NewDayActivity[];
}

export type DayActivityPatch = Partial<Omit<DayActivity, 'id' | 'user_id'>>;
export type TemplatePatch = Partial<Omit<TemplateActivity, 'id' | 'user_id'>>;
export type SettingsPatch = Partial<Omit<Settings, 'user_id'>>;
export type GoogleCalendarPatch = Partial<Pick<GoogleCalendar, 'enabled' | 'category_id' | 'kind' | 'notify' | 'hidden'>>;

export interface Store {
  listCategories(): Promise<Category[]>;
  insertCategory(c: NewCategory): Promise<Category>;
  updateCategory(id: string, patch: Partial<NewCategory>): Promise<void>;
  deleteCategory(id: string): Promise<void>;

  listTemplates(): Promise<TemplateActivity[]>;
  insertTemplates(rows: NewTemplate[]): Promise<TemplateActivity[]>;
  updateTemplate(id: string, patch: TemplatePatch): Promise<void>;
  deleteTemplates(ids: string[]): Promise<void>;

  getWeek(weekStart: ISODate): Promise<Week | null>;
  /** Si ya existe (carrera entre dos aperturas), devuelve la existente. */
  insertWeek(weekStart: ISODate, source: WeekSource): Promise<Week>;
  updateWeek(id: string, patch: { source: WeekSource }): Promise<void>;
  /** Borra la semana y (en cascada) todas sus actividades. */
  deleteWeek(id: string): Promise<void>;

  /** Fechas inclusivas. */
  listDayActivities(from: ISODate, to: ISODate): Promise<DayActivity[]>;
  getDayActivity(id: string): Promise<DayActivity | null>;
  insertDayActivities(rows: NewDayActivity[]): Promise<DayActivity[]>;
  updateDayActivity(id: string, patch: DayActivityPatch): Promise<void>;
  deleteDayActivities(ids: string[]): Promise<void>;
  /** Borra, recorta e inserta en una sola transacción (Supabase: función apply_day_changes). */
  applyDayChanges(changes: DayChanges): Promise<DayActivity[]>;

  getSettings(): Promise<Settings>;
  updateSettings(patch: SettingsPatch): Promise<void>;

  /** Google Calendar (solo lectura: los escribe el servidor). Fechas inclusivas. */
  listGoogleEvents(from: ISODate, to: ISODate): Promise<GoogleEventRow[]>;
  listGoogleCalendars(): Promise<GoogleCalendar[]>;
  updateGoogleCalendar(id: string, patch: GoogleCalendarPatch): Promise<void>;
}
