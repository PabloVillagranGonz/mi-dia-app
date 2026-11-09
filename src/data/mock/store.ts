// Store en memoria con los datos iniciales. Se usa sin .env.local y en los tests.

import { uuid } from '@/lib/uuid';
import type { Store } from '../store';
import type { GoogleEventRow } from '@/domain/googleEvents';
import type { Category, DayActivity, GoogleCalendar, Settings, TemplateActivity, Week } from '../types';
import { MOCK_USER_ID, seedCategories, seedTemplates } from './seed';

export interface MockGoogle {
  events?: GoogleEventRow[];
  calendars?: GoogleCalendar[];
}

/** `google`: eventos y calendarios de Google simulados (para tests). Por defecto, ninguno. */
export function createMockStore(google: MockGoogle = {}): Store {
  const db = {
    googleEvents: [...(google.events ?? [])],
    googleCalendars: [...(google.calendars ?? [])],
    categories: seedCategories.map((c) => ({ ...c })) as Category[],
    templates: seedTemplates.map((t) => ({ ...t })) as TemplateActivity[],
    weeks: [] as Week[],
    activities: [] as DayActivity[],
    settings: {
      user_id: MOCK_USER_ID,
      planning_reminder_weekday: 7,
      planning_reminder_time: '20:00',
      notifications_enabled: true,
      timezone: 'Europe/Madrid',
    } as Settings,
  };
  const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));

  return {
    async listCategories() {
      return clone([...db.categories].sort((a, b) => a.sort_order - b.sort_order));
    },
    async insertCategory(c) {
      const row = { ...c, id: uuid(), user_id: MOCK_USER_ID };
      db.categories.push(row);
      return clone(row);
    },
    async updateCategory(id, patch) {
      db.categories = db.categories.map((c) => (c.id === id ? { ...c, ...patch } : c));
    },
    async deleteCategory(id) {
      db.categories = db.categories.filter((c) => c.id !== id);
      const unset = <T extends { category_id: string | null }>(x: T) =>
        x.category_id === id ? { ...x, category_id: null } : x;
      db.templates = db.templates.map(unset);
      db.activities = db.activities.map(unset);
    },

    async listTemplates() {
      return clone(db.templates);
    },
    async insertTemplates(rows) {
      const created = rows.map((r) => ({ ...r, id: uuid(), user_id: MOCK_USER_ID }));
      db.templates.push(...created);
      return clone(created);
    },
    async updateTemplate(id, patch) {
      db.templates = db.templates.map((t) => (t.id === id ? { ...t, ...patch } : t));
    },
    async deleteTemplates(ids) {
      db.templates = db.templates.filter((t) => !ids.includes(t.id));
      db.activities = db.activities.map((a) =>
        a.template_activity_id && ids.includes(a.template_activity_id) ? { ...a, template_activity_id: null } : a,
      );
    },

    async getWeek(weekStart) {
      return clone(db.weeks.find((w) => w.week_start === weekStart) ?? null);
    },
    async insertWeek(weekStart, source) {
      const existing = db.weeks.find((w) => w.week_start === weekStart);
      if (existing) return clone(existing);
      const row: Week = { id: uuid(), user_id: MOCK_USER_ID, week_start: weekStart, source, planned_at: new Date().toISOString() };
      db.weeks.push(row);
      return clone(row);
    },
    async updateWeek(id, patch) {
      db.weeks = db.weeks.map((w) => (w.id === id ? { ...w, ...patch, planned_at: new Date().toISOString() } : w));
    },

    async deleteWeek(id) {
      db.weeks = db.weeks.filter((w) => w.id !== id);
      db.activities = db.activities.filter((a) => a.week_id !== id);
    },

    async listDayActivities(from, to) {
      return clone(db.activities.filter((a) => a.date >= from && a.date <= to));
    },
    async getDayActivity(id) {
      return clone(db.activities.find((a) => a.id === id) ?? null);
    },
    async insertDayActivities(rows) {
      const created = rows.map((r) => ({ ...r, id: uuid(), user_id: MOCK_USER_ID }));
      db.activities.push(...created);
      return clone(created);
    },
    async updateDayActivity(id, patch) {
      db.activities = db.activities.map((a) => (a.id === id ? { ...a, ...patch } : a));
    },
    async deleteDayActivities(ids) {
      db.activities = db.activities.filter((a) => !ids.includes(a.id));
    },

    async applyDayChanges(ch) {
      db.activities = db.activities
        .filter((a) => !ch.delete.includes(a.id))
        .map((a) => {
          const u = ch.update.find((x) => x.id === a.id);
          return u ? { ...a, start_time: u.start_time, end_time: u.end_time } : a;
        });
      const created = ch.insert.map((r) => ({ ...r, id: uuid(), user_id: MOCK_USER_ID }));
      db.activities.push(...created);
      return clone(created);
    },

    async getSettings() {
      return clone(db.settings);
    },
    async updateSettings(patch) {
      db.settings = { ...db.settings, ...patch };
    },

    async listGoogleEvents(from, to) {
      return clone(db.googleEvents.filter((e) => e.date >= from && e.date <= to));
    },
    async listGoogleCalendars() {
      return clone(db.googleCalendars);
    },
    async updateGoogleCalendar(id, patch) {
      db.googleCalendars = db.googleCalendars.map((c) => (c.id === id ? { ...c, ...patch } : c));
    },
  };
}
