// Edge Function `admin`: panel de administración (solo usuarios con user_flags.is_admin)
// y restablecimiento nocturno de la cuenta de demostración.
//
//   GET  /users                                   → lista de usuarios con su estado
//   POST /users          {email, password}        → crear usuario (con la rutina de ejemplo)
//   POST /user/password  {id, password}           → cambiar contraseña
//   POST /user/disabled  {id, disabled}           → desactivar / reactivar (no puede entrar)
//   POST /user/delete    {id}                     → borrar usuario y todos sus datos
//   POST /user/google    {id, allowed}            → dar o quitar Google Calendar
//   GET  /user/stats?id=…&weeks=8                 → estadísticas
//   GET  /demo                                    → estado de la cuenta de demostración
//   POST /demo-reset                              → crear o restablecer la demo (admin o cron)
//
// Secretos: DEMO_EMAIL y DEMO_PASSWORD (cuenta de demostración), CRON_SECRET, y los de Google
// (para desconectar a un usuario al quitarle el acceso). Desplegar con --no-verify-jwt.

import { admin, cors, disconnect, isCron, json, sessionUser } from '../_shared/gcal.ts';
// @ts-ignore: JS generado por `npm run build:functions`
import * as domain from '../_shared/domain.js';

const MIN_PASSWORD = 8;
const BANNED_FOREVER = '876000h'; // 100 años

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const check = <T>(res: { data: T; error: { message: string } | null }): T => {
  if (res.error) throw new HttpError(400, res.error.message);
  return res.data;
};

/** Para las llamadas de auth.admin, cuyo tipo de respuesta es una unión. */
const ok = (res: { error: { message: string } | null }) => {
  if (res.error) throw new HttpError(400, res.error.message);
};

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await admin.from('user_flags').select('is_admin').eq('user_id', userId).maybeSingle();
  return Boolean(data?.is_admin);
}

async function setFlags(userId: string, patch: Record<string, boolean>) {
  check(await admin.from('user_flags').upsert({ user_id: userId, ...patch, updated_at: new Date().toISOString() }));
}

function validPassword(p: unknown): string {
  if (typeof p !== 'string' || p.length < MIN_PASSWORD) {
    throw new HttpError(400, `La contraseña debe tener al menos ${MIN_PASSWORD} caracteres.`);
  }
  return p;
}

function validEmail(e: unknown): string {
  if (typeof e !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())) throw new HttpError(400, 'Email no válido.');
  return e.trim().toLowerCase();
}

// ── Usuarios ───────────────────────────────────────────────────
async function listUsers() {
  const { data, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const ids = data.users.map((u) => u.id);
  const [flags, subs, google] = await Promise.all([
    admin.from('user_flags').select('*').in('user_id', ids),
    admin.from('push_subscriptions').select('user_id').in('user_id', ids),
    admin.from('google_accounts').select('user_id, google_email').in('user_id', ids),
  ]);
  const flagOf = new Map((flags.data ?? []).map((f) => [f.user_id, f]));
  const devices = new Map<string, number>();
  for (const s of subs.data ?? []) devices.set(s.user_id, (devices.get(s.user_id) ?? 0) + 1);
  const googleOf = new Map((google.data ?? []).map((g) => [g.user_id, g.google_email]));

  return data.users
    .map((u) => {
      const f = flagOf.get(u.id);
      const banned = u.banned_until ? new Date(u.banned_until).getTime() > Date.now() : false;
      return {
        id: u.id,
        email: u.email ?? '',
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        disabled: banned,
        is_admin: Boolean(f?.is_admin),
        is_demo: Boolean(f?.is_demo),
        gcal_allowed: Boolean(f?.gcal_allowed),
        google_email: googleOf.get(u.id) ?? null,
        devices: devices.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => Number(b.is_admin) - Number(a.is_admin) || a.created_at.localeCompare(b.created_at));
}

async function createUser(body: Record<string, unknown>) {
  const email = validEmail(body.email);
  const password = validPassword(body.password);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    if (/already|registered|exists/i.test(error.message)) throw new HttpError(409, 'Ya existe un usuario con ese email.');
    throw new HttpError(400, error.message);
  }
  // El trigger on_auth_user_created le crea categorías, ajustes y la rutina de ejemplo
  return { id: data.user.id };
}

/** Comprueba que el usuario existe y no es quien llama (para acciones peligrosas). */
async function target(body: Record<string, unknown>, me: string, notSelf: boolean) {
  const id = String(body.id ?? '');
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new HttpError(400, 'Usuario no válido.');
  if (notSelf && id === me) throw new HttpError(400, 'No puedes hacer esto con tu propia cuenta.');
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error || !data.user) throw new HttpError(404, 'Ese usuario no existe.');
  return data.user;
}

async function stats(id: string, weeks: number) {
  const today: string = domain.localNow().date;
  const from = domain.addDays(domain.weekStartOf(today), -7 * (weeks - 1));
  const [acts, cats] = await Promise.all([
    admin.from('day_activities').select('date, start_time, end_time, kind, done, category_id').eq('user_id', id).gte('date', from).lte('date', today),
    admin.from('categories').select('id, name, color').eq('user_id', id).order('sort_order'),
  ]);
  const rows = (check(acts) as Array<Record<string, string>>).map((a) => ({
    ...a,
    start_time: domain.normalizeTime(a.start_time),
    end_time: domain.normalizeTime(a.end_time),
  }));
  return { from, today, stats: domain.userStats(rows, today), categories: check(cats) };
}

// ── Cuenta de demostración ─────────────────────────────────────
function demoConfig() {
  const email = Deno.env.get('DEMO_EMAIL')?.trim().toLowerCase();
  const password = Deno.env.get('DEMO_PASSWORD');
  return email && password ? { email, password } : null;
}

async function demoUsers(): Promise<string[]> {
  const { data } = await admin.from('user_flags').select('user_id').eq('is_demo', true);
  return (data ?? []).map((r) => r.user_id as string);
}

/** Crea la cuenta demo si no existe; si existe, le restablece email, contraseña y datos. */
async function demoReset() {
  const cfg = demoConfig();
  if (!cfg) throw new HttpError(400, 'Faltan los secretos DEMO_EMAIL y DEMO_PASSWORD.');
  let ids = await demoUsers();

  if (!ids.length) {
    // ¿Existe ya un usuario con ese email (creado a mano)? Se convierte en demo
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = data?.users.find((u) => u.email?.toLowerCase() === cfg.email);
    const id = existing?.id ?? (await createUser({ email: cfg.email, password: cfg.password })).id;
    await setFlags(id, { is_demo: true, is_admin: false, gcal_allowed: false });
    ids = [id];
  }

  for (const id of ids) {
    const { error } = await admin.auth.admin.updateUserById(id, {
      email: cfg.email,
      password: cfg.password,
      email_confirm: true,
      ban_duration: 'none',
      user_metadata: {},
    });
    if (error) throw new HttpError(400, error.message);
    // Cierra las sesiones abiertas para que nadie siga con los datos de antes
    await admin.auth.admin.signOut(id, 'global').catch(() => {});
    check(await admin.rpc('reset_user_data', { p_user: id }));
  }
  return { reset: ids.length, email: cfg.email };
}

// ── Rutas ──────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).slice(1).join('/'); // sin «admin»

  try {
    // Cron nocturno de la demo
    if (route === 'demo-reset' && req.method === 'POST' && isCron(req)) return json(await demoReset());

    const me = await sessionUser(req);
    if (!me) return json({ error: 'Sin sesión' }, 401);
    if (!(await isAdmin(me))) return json({ error: 'Solo para administradores' }, 403);

    const body = req.method === 'POST' ? ((await req.json().catch(() => ({}))) as Record<string, unknown>) : {};

    switch (`${req.method} ${route}`) {
      case 'GET users':
        return json({ users: await listUsers() });

      case 'POST users':
        return json(await createUser(body), 201);

      case 'POST user/password': {
        const u = await target(body, me, false);
        ok(await admin.auth.admin.updateUserById(u.id, { password: validPassword(body.password) }));
        return json({ ok: true });
      }

      case 'POST user/disabled': {
        const u = await target(body, me, true);
        const disabled = Boolean(body.disabled);
        ok(await admin.auth.admin.updateUserById(u.id, { ban_duration: disabled ? BANNED_FOREVER : 'none' }));
        if (disabled) await admin.auth.admin.signOut(u.id, 'global').catch(() => {});
        return json({ ok: true });
      }

      case 'POST user/delete': {
        const u = await target(body, me, true);
        // Si tenía Google conectado, revocar el permiso y parar los avisos antes de borrar
        const { data: g } = await admin.from('google_accounts').select('user_id').eq('user_id', u.id).maybeSingle();
        if (g) await disconnect(u.id).catch((e) => console.warn('admin delete: google', e));
        ok(await admin.auth.admin.deleteUser(u.id)); // en cascada, todos sus datos
        return json({ ok: true });
      }

      case 'POST user/google': {
        const u = await target(body, me, false);
        const allowed = Boolean(body.allowed);
        const { data: f } = await admin.from('user_flags').select('is_demo').eq('user_id', u.id).maybeSingle();
        if (allowed && f?.is_demo) throw new HttpError(400, 'La cuenta de demostración no puede usar Google Calendar.');
        await setFlags(u.id, { gcal_allowed: allowed });
        if (!allowed) {
          const { data: g } = await admin.from('google_accounts').select('user_id').eq('user_id', u.id).maybeSingle();
          if (g) await disconnect(u.id); // revoca, borra y restaura su rutina
        }
        return json({ ok: true });
      }

      case 'GET user/stats': {
        const u = await target({ id: url.searchParams.get('id') }, me, false);
        const weeks = Math.min(26, Math.max(1, Number(url.searchParams.get('weeks') ?? 8) || 8));
        return json(await stats(u.id, weeks));
      }

      case 'GET demo': {
        const cfg = demoConfig();
        return json({ configured: Boolean(cfg), email: cfg?.email ?? null, users: (await demoUsers()).length });
      }

      case 'POST demo-reset':
        return json(await demoReset());

      default:
        return json({ error: 'Ruta no encontrada' }, 404);
    }
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status);
    console.error('admin', e);
    return json({ error: (e as Error).message }, 500);
  }
});
