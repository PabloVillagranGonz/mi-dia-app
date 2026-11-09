// Código común de las Edge Functions gcal-* (Google Calendar → Mi Día, solo lectura).
//
// Secretos (Supabase → Edge Functions → Secrets):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET  credencial OAuth «Aplicación web» de Google Cloud
//   GCAL_STATE_SECRET                       texto aleatorio para firmar el `state` de OAuth
//   GCAL_ALLOWED_USER_IDS                   (opcional) UUIDs con acceso además de user_flags.gcal_allowed
//   APP_URL                                 https://mi-dia-app-seven.vercel.app (sin / final)
//   CRON_SECRET                             el mismo que usa `push` (pg_cron)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';

// @ts-ignore: JS generado por `npm run build:functions` (src/domain/server.ts)
import * as domain from './domain.js';

// ── Tipos mínimos (el paquete del dominio es JS) ───────────────
export interface GoogleEventRow {
  calendar_id: string;
  event_id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  updated: string;
}
interface CalendarRow {
  id: string;
  user_id: string;
  calendar_id: string;
  summary: string;
  enabled: boolean;
  category_id: string | null;
  kind: 'task' | 'fixed';
  notify: boolean;
  sync_token: string | null;
  sync_window_start: string | null;
  channel_id: string | null;
  channel_resource_id: string | null;
  channel_token: string | null;
  channel_expires_at: string | null;
}
interface DayChanges {
  delete: string[];
  update: Array<{ id: string; start_time: string; end_time: string }>;
  insert: Array<Record<string, unknown>>;
}
type Row = Record<string, unknown>;

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void };

// ── Entorno y utilidades HTTP ──────────────────────────────────
export const env = (name: string): string => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta el secreto ${name}`);
  return v;
};

export const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Lanza una tarea que sigue tras responder (la petición no espera). */
export function background(p: Promise<unknown>) {
  const logged = p.catch((e) => console.error('gcal background', e));
  try {
    EdgeRuntime.waitUntil(logged);
  } catch {
    /* fuera de Supabase: la promesa sigue igualmente */
  }
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ── Quién llama ────────────────────────────────────────────────
/**
 * ¿Puede usar Google Calendar? Lo decide el administrador (user_flags.gcal_allowed, desde /admin).
 * GCAL_ALLOWED_USER_IDS queda como respaldo (usuarios separados por comas).
 */
export async function isAllowed(userId: string): Promise<boolean> {
  const list = (Deno.env.get('GCAL_ALLOWED_USER_IDS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  if (list.includes(userId)) return true;
  const { data } = await admin.from('user_flags').select('gcal_allowed, is_demo').eq('user_id', userId).maybeSingle();
  return Boolean(data?.gcal_allowed) && !data?.is_demo;
}

/** Usuario de la sesión (Authorization: Bearer <jwt>), o null. */
export async function sessionUser(req: Request): Promise<string | null> {
  const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await admin.auth.getUser(jwt);
  return data.user?.id ?? null;
}

export function isCron(req: Request): boolean {
  const secret = Deno.env.get('CRON_SECRET');
  return Boolean(secret) && req.headers.get('x-cron-secret') === secret;
}

// ── OAuth ──────────────────────────────────────────────────────
export const SCOPES = 'openid email https://www.googleapis.com/auth/calendar.readonly';
export const redirectUri = () => `${env('APP_URL')}/api/gcal/callback`;

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

async function hmac(text: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(env('GCAL_STATE_SECRET')),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return b64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text))));
}

/** state = base64url(user_id.caducidad).firma — caduca a los 10 min. */
export async function signState(userId: string): Promise<string> {
  const payload = b64url(new TextEncoder().encode(`${userId}.${Date.now() + 10 * 60_000}`));
  return `${payload}.${await hmac(payload)}`;
}

export async function verifyState(state: string): Promise<string | null> {
  const [payload, sig] = state.split('.');
  if (!payload || !sig || (await hmac(payload)) !== sig) return null;
  const text = new TextDecoder().decode(
    Uint8Array.from(atob(payload.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)),
  );
  const [userId, exp] = text.split('.');
  return Number(exp) > Date.now() ? userId : null;
}

export async function tokenRequest(params: Record<string, string>): Promise<Record<string, string>> {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), ...params }),
  });
  const body = await res.json();
  if (!res.ok) throw Object.assign(new Error(`token: ${body.error ?? res.status}`), { code: body.error });
  return body;
}

async function accessToken(refreshToken: string): Promise<string> {
  return (await tokenRequest({ grant_type: 'refresh_token', refresh_token: refreshToken })).access_token;
}

export async function google(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  });
}

// ── Canales de aviso (events.watch) ────────────────────────────
const RENEW_BEFORE_MS = 48 * 3600_000;

export async function stopChannel(token: string, c: Pick<CalendarRow, 'channel_id' | 'channel_resource_id'>) {
  if (!c.channel_id || !c.channel_resource_id) return;
  const res = await google(token, '/channels/stop', {
    method: 'POST',
    body: JSON.stringify({ id: c.channel_id, resourceId: c.channel_resource_id }),
  });
  if (!res.ok && res.status !== 404) console.warn('channels.stop', res.status, await res.text());
}

async function watch(token: string, c: CalendarRow): Promise<Partial<CalendarRow>> {
  const id = crypto.randomUUID();
  const channelToken = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const res = await google(token, `/calendars/${encodeURIComponent(c.calendar_id)}/events/watch`, {
    method: 'POST',
    body: JSON.stringify({
      id,
      type: 'web_hook',
      address: `${env('SUPABASE_URL')}/functions/v1/gcal-webhook`,
      token: channelToken,
      params: { ttl: String(7 * 24 * 3600) },
    }),
  });
  if (!res.ok) {
    console.warn('events.watch', c.summary, res.status, await res.text());
    return {}; // sin aviso al momento: el cron de 15 min lo sigue sincronizando
  }
  const body = await res.json();
  return {
    channel_id: id,
    channel_resource_id: body.resourceId,
    channel_token: channelToken,
    channel_expires_at: new Date(Number(body.expiration)).toISOString(),
  };
}

// ── Sincronización ─────────────────────────────────────────────
async function listEvents(
  token: string,
  calendarId: string,
  syncToken: string | null,
  win: { timeMin: string; timeMax: string },
): Promise<{ items: unknown[]; nextSyncToken: string | null; full: boolean } | 'gone'> {
  const items: unknown[] = [];
  let pageToken: string | undefined;
  for (;;) {
    const q = new URLSearchParams({ singleEvents: 'true', maxResults: '250' });
    if (syncToken) q.set('syncToken', syncToken);
    else {
      q.set('timeMin', win.timeMin);
      q.set('timeMax', win.timeMax);
    }
    if (pageToken) q.set('pageToken', pageToken);
    const res = await google(token, `/calendars/${encodeURIComponent(calendarId)}/events?${q}`);
    if (res.status === 410) return 'gone'; // syncToken caducado → sync completo
    if (!res.ok) throw new Error(`events.list ${res.status}: ${await res.text()}`);
    const body = await res.json();
    items.push(...(body.items ?? []));
    pageToken = body.nextPageToken;
    if (!pageToken) return { items, nextSyncToken: body.nextSyncToken ?? null, full: !syncToken };
  }
}

async function syncCalendar(token: string, userId: string, c: CalendarRow, win: ReturnType<typeof domain.syncWindow>) {
  const patch: Partial<CalendarRow> = {};

  if (!c.enabled) {
    if (c.channel_id) await stopChannel(token, c);
    check(await admin.from('google_events').delete().eq('user_id', userId).eq('calendar_id', c.calendar_id));
    if (c.channel_id || c.sync_token) {
      check(
        await admin
          .from('google_calendars')
          .update({ sync_token: null, sync_window_start: null, channel_id: null, channel_resource_id: null, channel_token: null, channel_expires_at: null })
          .eq('id', c.id),
      );
    }
    return;
  }

  // Semana nueva → sync completo: el incremental no traería los eventos que entran en la ventana
  let syncToken = c.sync_window_start === win.from ? c.sync_token : null;
  let result = await listEvents(token, c.calendar_id, syncToken, win);
  if (result === 'gone') {
    syncToken = null;
    result = await listEvents(token, c.calendar_id, null, win);
    if (result === 'gone') throw new Error('events.list 410 en sync completo');
  }

  const current = (
    check(
      await admin
        .from('google_events')
        .select('calendar_id, event_id, date, start_time, end_time, title, updated')
        .eq('user_id', userId)
        .eq('calendar_id', c.calendar_id),
    ) as Row[]
  ).map(withTimes) as unknown as GoogleEventRow[];

  const plan = domain.planEventsSync(c.calendar_id, current, result.items, result.full, win) as {
    upsert: GoogleEventRow[];
    remove: Array<{ event_id: string; date: string }>;
  };
  for (const r of plan.remove) {
    check(
      await admin
        .from('google_events')
        .delete()
        .eq('user_id', userId)
        .eq('calendar_id', c.calendar_id)
        .eq('event_id', r.event_id)
        .eq('date', r.date),
    );
  }
  if (plan.upsert.length) {
    check(
      await admin
        .from('google_events')
        .upsert(plan.upsert.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,calendar_id,event_id,date' }),
    );
  }
  patch.sync_token = result.nextSyncToken;
  patch.sync_window_start = win.from;

  // Canal de aviso: crear o renovar si caduca en menos de 48 h
  const expires = c.channel_expires_at ? new Date(c.channel_expires_at).getTime() : 0;
  if (!c.channel_id || expires < Date.now() + RENEW_BEFORE_MS) {
    const fresh = await watch(token, c);
    if (fresh.channel_id) {
      if (c.channel_id) await stopChannel(token, c);
      Object.assign(patch, fresh);
    }
  }

  check(await admin.from('google_calendars').update(patch).eq('id', c.id));
}

const withTimes = (r: Row): Row => ({
  ...r,
  ...(typeof r.start_time === 'string' ? { start_time: domain.normalizeTime(r.start_time) } : {}),
  ...(typeof r.end_time === 'string' ? { end_time: domain.normalizeTime(r.end_time) } : {}),
});

/**
 * Reconstruye los días de hoy al domingo de la semana siguiente (solo los de semanas ya
 * generadas) con los eventos sincronizados. Cambios mínimos, en una transacción.
 */
export async function rebuildWindow(userId: string): Promise<number> {
  const today: string = domain.localNow().date;
  const win = domain.syncWindow(today);

  const [weeks, acts, templates, events, calendars] = await Promise.all([
    admin.from('weeks').select('id, week_start').eq('user_id', userId).gte('week_start', win.from).lte('week_start', win.to),
    admin.from('day_activities').select('*').eq('user_id', userId).gte('date', today).lte('date', win.to),
    admin.from('template_activities').select('*').eq('user_id', userId),
    admin
      .from('google_events')
      .select('calendar_id, event_id, date, start_time, end_time, title, updated')
      .eq('user_id', userId)
      .gte('date', domain.addDays(today, -1))
      .lte('date', domain.addDays(win.to, 1)),
    admin.from('google_calendars').select('calendar_id, category_id, kind, notify').eq('user_id', userId).eq('enabled', true),
  ]);
  const weekIds = new Map((check(weeks) as Row[]).map((w) => [w.week_start as string, w.id as string]));
  const existing = (check(acts) as Row[]).map(withTimes);
  const tpls = (check(templates) as Row[]).map(withTimes);
  const gevents = (check(events) as Row[]).map(withTimes);
  const cals = check(calendars) as Row[];

  const changes: DayChanges = { delete: [], update: [], insert: [] };
  for (let date = today; domain.compareDates(date, win.to) <= 0; date = domain.addDays(date, 1)) {
    const weekId = weekIds.get(domain.weekStartOf(date));
    if (!weekId) continue; // semana sin generar: la app los pondrá al crearla
    const c = domain.rebuildDay({ date, weekId, templates: tpls, existing, googleEvents: gevents, calendars: cals }) as DayChanges;
    changes.delete.push(...c.delete);
    changes.update.push(...c.update);
    changes.insert.push(...c.insert);
  }
  const total = changes.delete.length + changes.update.length + changes.insert.length;
  if (total) {
    check(
      await admin.rpc('apply_day_changes_as', {
        p_user: userId,
        p_delete: changes.delete,
        p_update: changes.update,
        p_insert: changes.insert,
      }),
    );
  }
  return total;
}

async function syncOnce(userId: string): Promise<{ calendars: number; changes: number }> {
  const account = check(
    await admin.from('google_accounts').select('refresh_token').eq('user_id', userId).maybeSingle(),
  ) as { refresh_token: string } | null;
  if (!account) return { calendars: 0, changes: 0 };

  let token: string;
  try {
    token = await accessToken(account.refresh_token);
  } catch (e) {
    // invalid_grant: el usuario quitó el acceso desde su cuenta de Google. Hay que reconectar.
    console.error('gcal refresh', userId, (e as Error).message);
    return { calendars: 0, changes: 0 };
  }

  const win = domain.syncWindow(domain.localNow().date);
  const calendars = check(await admin.from('google_calendars').select('*').eq('user_id', userId)) as CalendarRow[];
  for (const c of calendars) {
    try {
      await syncCalendar(token, userId, c, win);
    } catch (e) {
      console.error('gcal sync', c.summary, (e as Error).message); // los demás calendarios siguen
    }
  }
  return { calendars: calendars.filter((c) => c.enabled).length, changes: await rebuildWindow(userId) };
}

/**
 * Sincroniza un usuario. Si ya hay otra sincronización en marcha, le deja apuntado que repita
 * (así un aviso de Google que llega a mitad no se pierde) y vuelve sin hacer nada.
 */
export async function syncUser(userId: string): Promise<{ calendars: number; changes: number } | { busy: true }> {
  if (!check(await admin.rpc('gcal_lock', { p_user: userId }))) return { busy: true };
  let last = { calendars: 0, changes: 0 };
  try {
    for (;;) {
      last = await syncOnce(userId);
      const again = check(await admin.rpc('gcal_unlock', { p_user: userId })) as unknown as boolean;
      if (!again || !check(await admin.rpc('gcal_lock', { p_user: userId }))) return last;
    }
  } catch (e) {
    await admin.rpc('gcal_unlock', { p_user: userId });
    throw e;
  }
}

/** Desconectar: para los canales, revoca el permiso en Google, borra todo y restaura la rutina. */
export async function disconnect(userId: string): Promise<void> {
  const account = check(
    await admin.from('google_accounts').select('refresh_token').eq('user_id', userId).maybeSingle(),
  ) as { refresh_token: string } | null;
  const calendars = check(await admin.from('google_calendars').select('*').eq('user_id', userId)) as CalendarRow[];
  if (account) {
    try {
      const token = await accessToken(account.refresh_token);
      for (const c of calendars) await stopChannel(token, c);
    } catch (e) {
      console.warn('gcal disconnect: canales', (e as Error).message);
    }
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(account.refresh_token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    }).catch(() => {});
  }
  check(await admin.from('google_events').delete().eq('user_id', userId));
  check(await admin.from('google_calendars').delete().eq('user_id', userId));
  check(await admin.from('google_accounts').delete().eq('user_id', userId));
  await rebuildWindow(userId); // sin calendarios: quita los eventos de Google y vuelve la rutina
}

// ── Alta de calendarios al conectar ────────────────────────────
const plain = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Trae la lista de calendarios. Los nuevos con «charanga» → Música y «running» → Salud, ya activos. */
export async function importCalendars(userId: string, token: string): Promise<void> {
  const res = await google(token, '/users/me/calendarList?minAccessRole=reader');
  if (!res.ok) throw new Error(`calendarList ${res.status}`);
  const items = ((await res.json()).items ?? []) as Array<{
    id: string;
    summary?: string;
    summaryOverride?: string;
    backgroundColor?: string;
  }>;

  const cats = check(await admin.from('categories').select('id, name').eq('user_id', userId)) as Array<{ id: string; name: string }>;
  const catId = (name: string) => cats.find((c) => plain(c.name) === name)?.id ?? null;
  const existing = new Set(
    (check(await admin.from('google_calendars').select('calendar_id').eq('user_id', userId)) as Row[]).map((r) => r.calendar_id),
  );

  for (const it of items) {
    const summary = it.summaryOverride || it.summary || it.id;
    if (existing.has(it.id)) {
      check(await admin.from('google_calendars').update({ summary, color: it.backgroundColor ?? null }).eq('user_id', userId).eq('calendar_id', it.id));
      continue;
    }
    const n = plain(summary);
    const category_id = n.includes('charanga') ? catId('musica') : n.includes('running') ? catId('salud') : null;
    check(
      await admin.from('google_calendars').insert({
        user_id: userId,
        calendar_id: it.id,
        summary,
        color: it.backgroundColor ?? null,
        enabled: Boolean(category_id),
        category_id,
        kind: 'task',
        notify: true,
      }),
    );
  }
}
