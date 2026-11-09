// Tests de la parte SQL: claim_due_push() (avisos Web Push) frente a la lógica de la app,
// permisos de las tablas de Google Calendar (0005) y del panel de administración (0008).
// Uso:  npm run test:sql
//
// Levanta un Postgres embebido (PGlite, sin Docker ni red), carga las migraciones reales
// (con un esquema `auth` mínimo que imita a Supabase) y comprueba que el servidor avisa
// exactamente cuando y como lo haría src/domain/notifications.ts.

import { PGlite } from '@electric-sql/pglite';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { zonedToInstant } from '../src/domain/clock';
import { planActivityNotifications } from '../src/domain/notifications';

const MIGRATIONS = ['0001_init.sql', '0002_apply_day_changes.sql', '0003_web_push.sql', '0005_google_calendar.sql', '0007_gcal_hidden.sql', '0008_admin.sql'];
const USER = '00000000-0000-0000-0000-00000000000a';
const OTHER = '00000000-0000-0000-0000-00000000000b'; // sin dispositivo suscrito
const WEEK = '00000000-0000-0000-0000-0000000000f1';
const SPLIT = '00000000-0000-0000-0000-0000000000c1';

type Row = { user_id: string; key: string; title: string; body: string; url: string };

interface Act {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  title: string;
  notify: boolean;
  split_group_id: string | null;
}

let n = 0;
const act = (date: string, start: string, end: string, title: string, notify = true, split: string | null = null): Act => ({
  id: `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`,
  date,
  start_time: start,
  end_time: end,
  title,
  notify,
  split_group_id: split,
});

// Lunes 9 y martes 10 de noviembre de 2026, con los casos delicados
const ACTS: Act[] = [
  act('2026-11-09', '09:00', '10:00', 'Desayuno'),
  act('2026-11-09', '10:00', '12:30', 'Programar', false), // sin aviso, pero es «Siguiente» de la anterior
  act('2026-11-09', '12:30', '13:00', 'Recados'),
  act('2026-11-09', '23:00', '24:00', 'Dormir tarde', true, SPLIT), // cruza medianoche…
  act('2026-11-10', '00:00', '01:00', 'Dormir tarde', true, SPLIT), // …y su segunda mitad no avisa
  act('2026-11-10', '08:00', '09:00', 'Deporte'),
  act('2026-11-10', '21:00', '22:00', 'Cena'), // última: sin «Siguiente» dentro de la ventana
];

const minute = 60_000;
const iso = (d: Date) => d.toISOString();

async function setup(): Promise<PGlite> {
  const db = new PGlite();
  // Lo mínimo de Supabase que usan las migraciones
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema auth;
    create table auth.users (id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth to anon, authenticated, service_role;
    -- Como Supabase: las tablas nuevas de public dan todos los permisos a los tres roles
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  `);
  for (const f of MIGRATIONS) await db.exec(readFileSync(join('supabase/migrations', f), 'utf8'));

  // El trigger de alta crea categorías, rutina y ajustes de cada usuario
  await db.query(`insert into auth.users (id, email) values ($1, 'a@test'), ($2, 'b@test')`, [USER, OTHER]);
  await db.query(`insert into public.weeks (id, user_id, week_start, source) values ($1, $2, '2026-11-09', 'base')`, [WEEK, USER]);
  for (const a of ACTS) {
    await db.query(
      `insert into public.day_activities (id, user_id, week_id, date, start_time, end_time, title, kind, origin, notify, split_group_id)
       values ($1, $2, $3, $4, $5, $6, $7, 'task', 'manual', $8, $9)`,
      [a.id, USER, WEEK, a.date, a.start_time, a.end_time, a.title, a.notify, a.split_group_id],
    );
  }
  await db.query(
    `insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/1', 'k', 'a')`,
    [USER],
  );
  return db;
}

async function claim(db: PGlite, at: Date): Promise<Row[]> {
  return (await db.query<Row>(`select * from public.claim_due_push($1::timestamptz)`, [iso(at)])).rows;
}

const tests: Array<[string, () => Promise<void>]> = [];
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn]);

test('cada minuto de dos días: avisa lo mismo que la app, a su hora y una sola vez', async () => {
  const db = await setup();
  const from = zonedToInstant('2026-11-09', 0);
  const to = zonedToInstant('2026-11-11', 0);
  const expected = planActivityNotifications(ACTS, new Date(from.getTime() - 1));

  const got = new Map<string, { row: Row; at: Date }>();
  for (let t = from.getTime(); t < to.getTime(); t += minute) {
    for (const row of await claim(db, new Date(t))) {
      assert.ok(!got.has(row.key), `aviso repetido: ${row.key}`);
      got.set(row.key, { row, at: new Date(t) });
    }
  }

  const acts = [...got.values()].filter((g) => g.row.key.startsWith('act:'));
  assert.equal(acts.length, expected.length, `esperados ${expected.length} avisos, llegaron ${acts.length}`);
  for (const e of expected) {
    const a = ACTS.find((x) => `act:${x.id}` === e.id)!;
    const g = got.get(`act:${a.id}:${a.date}`);
    assert.ok(g, `falta el aviso de «${e.title}» (${a.date} ${a.start_time})`);
    assert.equal(g.row.user_id, USER);
    assert.equal(g.row.title, e.title);
    assert.equal(g.row.body, e.body, `cuerpo de «${e.title}»`);
    assert.equal(g.row.url, '/');
    assert.equal(g.at.getTime(), e.at.getTime(), `«${e.title}» debe salir justo a su hora`);
  }
});

test('la segunda mitad de una actividad que cruza medianoche no avisa', async () => {
  const db = await setup();
  const rows = await claim(db, zonedToInstant('2026-11-10', 0));
  assert.deepEqual(rows, []);
});

test('«Siguiente» salta la segunda mitad de la propia actividad', async () => {
  const db = await setup();
  const [row] = await claim(db, zonedToInstant('2026-11-09', 23 * 60));
  assert.equal(row.body, 'Hasta las 00:00 · Siguiente: Deporte');
});

test('si el cron se retrasa hasta 3 minutos, el aviso sale igualmente; más tarde, no', async () => {
  const db = await setup();
  const start = zonedToInstant('2026-11-09', 9 * 60);
  assert.equal((await claim(db, new Date(start.getTime() + 2 * minute + 59_000))).length, 1);
  const db2 = await setup();
  assert.equal((await claim(db2, new Date(start.getTime() + 3 * minute))).length, 0);
});

test('con las notificaciones desactivadas en Ajustes no avisa', async () => {
  const db = await setup();
  await db.query(`update public.settings set notifications_enabled = false where user_id = $1`, [USER]);
  assert.deepEqual(await claim(db, zonedToInstant('2026-11-09', 9 * 60)), []);
});

test('sin ningún dispositivo suscrito no avisa (ni gasta el aviso)', async () => {
  const db = await setup();
  await db.query(`delete from public.push_subscriptions`);
  const at = zonedToInstant('2026-11-09', 9 * 60);
  assert.deepEqual(await claim(db, at), []);
  await db.query(`insert into public.push_subscriptions (user_id, endpoint, p256dh, auth) values ($1, 'https://push.example/2', 'k', 'a')`, [USER]);
  assert.equal((await claim(db, at)).length, 1);
});

test('recordatorio de planificación: el día y la hora de Ajustes, una vez', async () => {
  const db = await setup();
  // Por defecto: domingo 20:00. El domingo 15 de noviembre de 2026:
  const at = zonedToInstant('2026-11-15', 20 * 60);
  assert.deepEqual(await claim(db, new Date(at.getTime() - minute)), []);
  const rows = await claim(db, at);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].key, 'plan:2026-11-15');
  assert.equal(rows[0].title, 'Planifica tu semana');
  assert.equal(rows[0].url, '/planificar');
  assert.deepEqual(await claim(db, new Date(at.getTime() + minute)), []);
  // Otro día de la semana a la misma hora: nada
  assert.deepEqual(await claim(db, zonedToInstant('2026-11-14', 20 * 60)), []);
  // Cambiado a miércoles 07:30
  await db.query(`update public.settings set planning_reminder_weekday = 3, planning_reminder_time = '07:30' where user_id = $1`, [USER]);
  assert.equal((await claim(db, zonedToInstant('2026-11-11', 7 * 60 + 30))).length, 1);
});

test('cambio de hora: la hora local de Madrid se respeta en verano y en invierno', async () => {
  const db = await setup();
  const summer = act('2026-07-01', '09:00', '10:00', 'Verano');
  const winter = act('2026-12-01', '09:00', '10:00', 'Invierno');
  for (const a of [summer, winter]) {
    await db.query(
      `insert into public.day_activities (id, user_id, week_id, date, start_time, end_time, title, kind, origin, notify)
       values ($1, $2, $3, $4, $5, $6, $7, 'task', 'manual', true)`,
      [a.id, USER, WEEK, a.date, a.start_time, a.end_time, a.title],
    );
  }
  // 09:00 en Madrid = 07:00 UTC en verano y 08:00 UTC en invierno
  assert.equal((await claim(db, new Date('2026-07-01T07:00:00Z')))[0]?.title, 'Verano');
  assert.equal((await claim(db, new Date('2026-12-01T08:00:00Z')))[0]?.title, 'Invierno');
});

test('la app no puede llamar a claim_due_push (solo la Edge Function)', async () => {
  const db = await setup();
  const rows = (
    await db.query<{ anon: boolean; auth: boolean; service: boolean }>(`
      select has_function_privilege('anon', 'public.claim_due_push(timestamptz)', 'execute') as anon,
             has_function_privilege('authenticated', 'public.claim_due_push(timestamptz)', 'execute') as auth,
             has_function_privilege('service_role', 'public.claim_due_push(timestamptz)', 'execute') as service`)
  ).rows;
  assert.deepEqual(rows[0], { anon: false, auth: false, service: true });
});

// ── Google Calendar (0005) ─────────────────────────────────────

/** Ejecuta `fn` como un usuario autenticado de la app (rol authenticated + su uid). */
async function asUser<T>(db: PGlite, uid: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${uid}', false);`);
  try {
    return await fn();
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

async function failsWith(p: Promise<unknown>, re: RegExp) {
  await assert.rejects(p, (e: Error) => re.test(e.message));
}

async function setupGoogle(): Promise<PGlite> {
  const db = await setup();
  for (const u of [USER, OTHER]) {
    await db.query(`insert into public.google_accounts (user_id, google_email, refresh_token) values ($1, 'x@gmail.com', 'secreto')`, [u]);
    await db.query(
      `insert into public.google_calendars (user_id, calendar_id, summary, sync_token, channel_id, channel_token)
       values ($1::uuid, 'cal-' || $1::text, 'Charanga Jaleo', 'tok', 'chan', 'chantok')`,
      [u],
    );
    await db.query(
      `insert into public.google_events (user_id, calendar_id, event_id, date, start_time, end_time, title, updated)
       values ($1::uuid, 'cal-' || $1::text, 'ev1', '2026-11-10', '18:00', '19:00', 'Ensayo', now())`,
      [u],
    );
  }
  return db;
}

test('google_accounts: la app no puede leer el refresh token', async () => {
  const db = await setupGoogle();
  await asUser(db, USER, () => failsWith(db.query(`select * from public.google_accounts`), /permission denied/));
});

test('google_calendars: lee los suyos sin tokens y solo cambia sus preferencias', async () => {
  const db = await setupGoogle();
  await asUser(db, USER, async () => {
    const rows = (await db.query<{ summary: string }>(`select id, summary, enabled, category_id, kind, notify from public.google_calendars`)).rows;
    assert.equal(rows.length, 1, 'solo ve su calendario');
    await failsWith(db.query(`select sync_token from public.google_calendars`), /permission denied/);
    await failsWith(db.query(`select channel_token from public.google_calendars`), /permission denied/);
    await failsWith(db.query(`select * from public.google_calendars`), /permission denied/);
    await db.query(`update public.google_calendars set enabled = true, kind = 'fixed', notify = false, hidden = true`);
    assert.equal((await db.query<{ hidden: boolean }>(`select hidden from public.google_calendars`)).rows[0].hidden, true);
    await failsWith(db.query(`update public.google_calendars set sync_token = 'x'`), /permission denied/);
    await failsWith(db.query(`update public.google_calendars set user_id = $1`, [OTHER]), /permission denied/);
    await failsWith(db.query(`insert into public.google_calendars (user_id, calendar_id, summary) values ($1, 'c', 's')`, [USER]), /permission denied/);
    await failsWith(db.query(`delete from public.google_calendars`), /permission denied/);
  });
  const other = await db.query<{ enabled: boolean }>(`select enabled from public.google_calendars where user_id = $1`, [OTHER]);
  assert.equal(other.rows[0].enabled, false, 'no toca el calendario de otro usuario');
});

test('google_events: lee los suyos y no puede escribir', async () => {
  const db = await setupGoogle();
  await asUser(db, USER, async () => {
    assert.equal((await db.query(`select * from public.google_events`)).rows.length, 1);
    await failsWith(db.query(`delete from public.google_events`), /permission denied/);
    await failsWith(
      db.query(`insert into public.google_events values ($1, 'c', 'e', '2026-11-10', '10:00', '11:00', 't', now())`, [USER]),
      /permission denied/,
    );
  });
});

test('apply_day_changes guarda external_id; apply_day_changes_as y el cerrojo son solo del servidor', async () => {
  const db = await setupGoogle();
  const insert = JSON.stringify([
    { week_id: WEEK, date: '2026-11-10', start_time: '18:00', end_time: '19:00', title: 'Ensayo', category_id: null, kind: 'task',
      origin: 'event', template_activity_id: null, split_group_id: null, notify: true, edited: false, done: false, done_at: null,
      note: null, external_id: 'gcal:cal:ev1' },
  ]);
  const rows = await asUser(db, USER, async () => {
    await failsWith(db.query(`select public.apply_day_changes_as($1, '{}', '[]', '[]')`, [USER]), /permission denied/);
    await failsWith(db.query(`select public.gcal_lock($1)`, [USER]), /permission denied/);
    return (await db.query<{ external_id: string }>(`select * from public.apply_day_changes('{}', '[]', $1::jsonb)`, [insert])).rows;
  });
  assert.equal(rows[0].external_id, 'gcal:cal:ev1');

  const priv = (fn: string) => db.query<{ ok: boolean }>(`select has_function_privilege('service_role', '${fn}', 'execute') as ok`);
  assert.equal((await priv('public.apply_day_changes_as(uuid, uuid[], jsonb, jsonb)')).rows[0].ok, true);

  // Desde el servidor (sin RLS) con el usuario explícito
  const mine = (await db.query<{ user_id: string }>(`select * from public.apply_day_changes_as($1, '{}', '[]', $2::jsonb)`, [OTHER, insert])).rows;
  assert.equal(mine[0].user_id, OTHER);
});

test('cerrojo de sincronización: uno a la vez y repetir si llegó otro aviso', async () => {
  const db = await setupGoogle();
  const lock = async () => (await db.query<{ ok: boolean }>(`select public.gcal_lock($1) as ok`, [USER])).rows[0].ok;
  const unlock = async () => (await db.query<{ again: boolean }>(`select public.gcal_unlock($1) as again`, [USER])).rows[0].again;
  assert.equal(await lock(), true);
  assert.equal(await lock(), false, 'el segundo no entra…');
  assert.equal(await unlock(), true, '…pero deja apuntado que hay que repetir');
  assert.equal(await lock(), true);
  assert.equal(await unlock(), false);
  // Un cerrojo caducado (función colgada) no bloquea para siempre
  await db.query(`update public.google_accounts set sync_lock_until = now() - interval '1 second' where user_id = $1`, [USER]);
  assert.equal(await lock(), true);
});

// ── Administración y demo (0008) ───────────────────────────────

test('user_flags: cada usuario lee solo su fila y nadie la escribe desde la app', async () => {
  const db = await setup();
  await db.query(`insert into public.user_flags (user_id, is_admin) values ($1, true), ($2, false)`, [USER, OTHER]);
  await asUser(db, OTHER, async () => {
    const rows = (await db.query<{ user_id: string; is_admin: boolean }>(`select user_id, is_admin from public.user_flags`)).rows;
    assert.deepEqual(rows, [{ user_id: OTHER, is_admin: false }], 'no ve la fila del administrador');
    await failsWith(db.query(`update public.user_flags set is_admin = true`), /permission denied/);
    await failsWith(db.query(`insert into public.user_flags (user_id, is_admin) values ($1, true)`, [OTHER]), /permission denied/);
    await failsWith(db.query(`select public.reset_user_data($1)`, [OTHER]), /permission denied/);
  });
});

test('reset_user_data: solo con cuentas demo; deja la rutina de ejemplo y borra lo demás', async () => {
  const db = await setup();
  await failsWith(db.query(`select public.reset_user_data($1)`, [USER]), /demostraci/);

  await db.query(`insert into public.user_flags (user_id, is_demo) values ($1, true)`, [USER]);
  const count = async (t: string) =>
    Number((await db.query<{ n: string }>(`select count(*) n from public.${t} where user_id = $1`, [USER])).rows[0].n);
  const templatesBefore = await count('template_activities');
  await db.query(`delete from public.template_activities where user_id = $1 and weekday = 1`, [USER]); // «estropear» la rutina
  await db.query(`update public.settings set notifications_enabled = false where user_id = $1`, [USER]);

  await db.query(`select public.reset_user_data($1)`, [USER]);

  assert.equal(await count('template_activities'), templatesBefore, 'rutina de ejemplo completa');
  assert.equal(await count('categories'), 4);
  assert.equal(await count('day_activities'), 0);
  assert.equal(await count('weeks'), 0);
  assert.equal(await count('push_subscriptions'), 0);
  const s = await db.query<{ n: boolean }>(`select notifications_enabled n from public.settings where user_id = $1`, [USER]);
  assert.equal(s.rows[0].n, true, 'ajustes por defecto');
  // El otro usuario no se toca
  assert.ok(Number((await db.query<{ n: string }>(`select count(*) n from public.categories where user_id = $1`, [OTHER])).rows[0].n) > 0);
});

(async () => {
  let failed = 0;
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${name}\n    ${(e as Error).message.split('\n').join('\n    ')}`);
    }
  }
  console.log(`\n${tests.length - failed} de ${tests.length} tests SQL pasan`);
  process.exit(failed ? 1 : 0);
})();
