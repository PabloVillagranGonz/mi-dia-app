// Store sobre Supabase. Postgres devuelve las horas como 'HH:MM:SS': aquí se normalizan a 'HH:MM'.

import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeTime } from '@/domain/time';
import type { Store } from '../store';
import type { Category, DayActivity, Settings, TemplateActivity, Week } from '../types';

type Row = Record<string, unknown>;

const withTimes = <T extends Row>(r: T): T => ({
  ...r,
  ...(typeof r.start_time === 'string' ? { start_time: normalizeTime(r.start_time) } : {}),
  ...(typeof r.end_time === 'string' ? { end_time: normalizeTime(r.end_time) } : {}),
});

function check<T>(res: { data: T; error: { message: string; code?: string } | null }): T {
  if (res.error) throw Object.assign(new Error(res.error.message), { code: res.error.code });
  return res.data;
}

export function createSupabaseStore(sb: SupabaseClient): Store {
  async function userId(): Promise<string> {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new Error('No hay sesión iniciada');
    return id;
  }

  return {
    async listCategories() {
      return check(await sb.from('categories').select('*').order('sort_order')) as Category[];
    },
    async insertCategory(c) {
      return check(await sb.from('categories').insert({ ...c, user_id: await userId() }).select().single()) as Category;
    },
    async updateCategory(id, patch) {
      check(await sb.from('categories').update(patch).eq('id', id));
    },
    async deleteCategory(id) {
      check(await sb.from('categories').delete().eq('id', id));
    },

    async listTemplates() {
      const rows = check(await sb.from('template_activities').select('*').order('weekday').order('start_time'));
      return (rows as Row[]).map(withTimes) as unknown as TemplateActivity[];
    },
    async insertTemplates(rows) {
      if (!rows.length) return [];
      const uid = await userId();
      const out = check(await sb.from('template_activities').insert(rows.map((r) => ({ ...r, user_id: uid }))).select());
      return (out as Row[]).map(withTimes) as unknown as TemplateActivity[];
    },
    async updateTemplate(id, patch) {
      check(await sb.from('template_activities').update(patch).eq('id', id));
    },
    async deleteTemplates(ids) {
      if (!ids.length) return;
      check(await sb.from('template_activities').delete().in('id', ids));
    },

    async getWeek(weekStart) {
      return check(await sb.from('weeks').select('*').eq('week_start', weekStart).maybeSingle()) as Week | null;
    },
    async insertWeek(weekStart, source) {
      const res = await sb.from('weeks').insert({ week_start: weekStart, source, user_id: await userId() }).select().single();
      if (res.error?.code === '23505') {
        // Ya la creó otra apertura de la app
        return check(await sb.from('weeks').select('*').eq('week_start', weekStart).single()) as Week;
      }
      return check(res) as Week;
    },
    async updateWeek(id, patch) {
      check(await sb.from('weeks').update({ ...patch, planned_at: new Date().toISOString() }).eq('id', id));
    },

    async deleteWeek(id) {
      check(await sb.from('weeks').delete().eq('id', id));
    },

    async listDayActivities(from, to) {
      const rows = check(
        await sb.from('day_activities').select('*').gte('date', from).lte('date', to).order('date').order('start_time'),
      );
      return (rows as Row[]).map(withTimes) as unknown as DayActivity[];
    },
    async getDayActivity(id) {
      const row = check(await sb.from('day_activities').select('*').eq('id', id).maybeSingle());
      return row ? (withTimes(row as Row) as unknown as DayActivity) : null;
    },
    async insertDayActivities(rows) {
      if (!rows.length) return [];
      const uid = await userId();
      const out = check(await sb.from('day_activities').insert(rows.map((r) => ({ ...r, user_id: uid }))).select());
      return (out as Row[]).map(withTimes) as unknown as DayActivity[];
    },
    async updateDayActivity(id, patch) {
      check(await sb.from('day_activities').update(patch).eq('id', id));
    },
    async deleteDayActivities(ids) {
      if (!ids.length) return;
      check(await sb.from('day_activities').delete().in('id', ids));
    },

    async getSettings() {
      const row = check(await sb.from('settings').select('*').maybeSingle()) as Settings | null;
      if (row) return { ...row, planning_reminder_time: normalizeTime(row.planning_reminder_time) };
      // Por si el alta inicial no creó la fila
      const created = check(await sb.from('settings').insert({ user_id: await userId() }).select().single()) as Settings;
      return { ...created, planning_reminder_time: normalizeTime(created.planning_reminder_time) };
    },
    async updateSettings(patch) {
      check(await sb.from('settings').update(patch).eq('user_id', await userId()));
    },
  };
}
