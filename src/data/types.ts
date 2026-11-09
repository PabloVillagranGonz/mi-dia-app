// Tipos con la misma forma que las tablas de supabase/migrations/0001_init.sql.
// Fechas: 'YYYY-MM-DD'. Horas: 'HH:MM' (24 h, admite '24:00').

export type UUID = string;
export type ISODate = string; // 'YYYY-MM-DD'
export type HHMM = string;    // 'HH:MM'

export type ActivityKind = 'task' | 'fixed';
export type ActivityOrigin = 'template' | 'event' | 'manual';
export type WeekSource = 'base' | 'copy' | 'auto';
/** 1 = lunes … 7 = domingo */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Category {
  id: UUID;
  user_id: UUID;
  name: string;
  color: string;
  sort_order: number;
}

export interface TemplateActivity {
  id: UUID;
  user_id: UUID;
  weekday: Weekday;
  start_time: HHMM;
  end_time: HHMM;
  title: string;
  category_id: UUID | null;
  kind: ActivityKind;
  notify: boolean;
  split_group_id: UUID | null;
}

export interface Week {
  id: UUID;
  user_id: UUID;
  week_start: ISODate; // siempre lunes
  source: WeekSource;
  planned_at: string;
}

export interface DayActivity {
  id: UUID;
  user_id: UUID;
  week_id: UUID;
  date: ISODate;
  start_time: HHMM;
  end_time: HHMM;
  title: string;
  category_id: UUID | null;
  kind: ActivityKind;
  origin: ActivityOrigin;
  template_activity_id: UUID | null;
  split_group_id: UUID | null;
  notify: boolean;
  /** Ajustada a mano ese día: «aplicar rutina base» no la sobrescribe. */
  edited: boolean;
  done: boolean;
  done_at: string | null;
  note: string | null;
}

export interface Settings {
  user_id: UUID;
  planning_reminder_weekday: Weekday;
  planning_reminder_time: HHMM;
  notifications_enabled: boolean;
  timezone: string;
}
