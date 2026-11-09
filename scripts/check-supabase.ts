// Comprueba la conexión con Supabase usando el MISMO código que la app (store + repositorio).
// Uso:  npm run check:supabase
// Pide email y contraseña por terminal (la contraseña no se muestra ni se guarda).
//
// Qué hace: entra con tu usuario, lee categorías, rutina y ajustes, y genera la semana actual
// si aún no existe (lo mismo que hará la app al abrirse). No borra ni modifica nada más.

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';

import { createRepository } from '../src/data/repository';
import { createSupabaseStore } from '../src/data/supabase/store';
import { localNow } from '../src/domain/clock';
import { addDays, weekStartOf } from '../src/domain/time';

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (m) env[m[1]] = m[2];
  }
  return env;
}

async function ask(question: string, hidden = false): Promise<string> {
  let muted = false;
  const output = new Writable({
    write(chunk, _enc, cb) {
      if (!muted) process.stdout.write(chunk);
      cb();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = hidden;
  });
}

const ok = (msg: string) => console.log(`  ✅ ${msg}`);
const fail = (msg: string) => console.log(`  ❌ ${msg}`);

async function main() {
  const env = loadEnv();
  const url = env.EXPO_PUBLIC_SUPABASE_URL;
  const key = env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) throw new Error('Faltan EXPO_PUBLIC_SUPABASE_URL o EXPO_PUBLIC_SUPABASE_KEY en .env.local');

  console.log(`\nProyecto: ${url}\n`);
  const email = await ask('Email: ');
  const password = await ask('Contraseña (no se ve al escribir): ', true);

  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  console.log('\n1. Login');
  const { data: login, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !login.session) {
    fail(`No se pudo entrar: ${error?.message ?? 'sin sesión'}`);
    process.exit(1);
  }
  ok(`Sesión iniciada como ${login.user?.email}`);

  const store = createSupabaseStore(sb);
  const repo = createRepository(store);
  let problems = 0;

  console.log('\n2. Datos iniciales (alta automática)');
  const categories = await repo.getCategories();
  if (categories.length === 4) ok(`4 categorías: ${categories.map((c) => c.name).join(', ')}`);
  else (problems++, fail(`Esperaba 4 categorías y hay ${categories.length}`));

  const templates = await repo.getTemplates();
  if (templates.length === 49) ok('49 actividades en la rutina base');
  else (problems++, fail(`Esperaba 49 actividades en la rutina base y hay ${templates.length}`));
  const sample = templates.find((t) => t.weekday === 1 && t.title === 'Dormir');
  if (sample && sample.start_time === '00:30' && sample.end_time === '09:00') ok('Horas leídas en formato HH:MM (00:30–09:00)');
  else (problems++, fail(`Formato de horas inesperado: ${JSON.stringify(sample)}`));

  const settings = await repo.getSettings();
  ok(`Ajustes: recordatorio ${['L', 'M', 'X', 'J', 'V', 'S', 'D'][settings.planning_reminder_weekday - 1]} a las ${settings.planning_reminder_time}, avisos ${settings.notifications_enabled ? 'activados' : 'desactivados'}`);

  console.log('\n3. Semana actual');
  const today = localNow().date;
  const weekStart = weekStartOf(today);
  const existed = await repo.getWeek(weekStart);
  const week = await repo.ensureWeek(weekStart);
  ok(`Semana del ${weekStart}: ${existed ? 'ya existía' : 'generada ahora'} (source = ${week.source})`);
  const acts = await repo.getRange(weekStart, addDays(weekStart, 6));
  if (acts.length >= 1) ok(`${acts.length} actividades esta semana`);
  else (problems++, fail('La semana no tiene actividades'));
  const todays = acts.filter((a) => a.date === today);
  ok(`Hoy (${today}): ${todays.length} actividades`);

  console.log('\n4. Cambios en una sola transacción (0002_apply_day_changes.sql)');
  const rpc = await sb.rpc('apply_day_changes', { p_delete: [], p_update: [], p_insert: [] });
  if (!rpc.error) ok('Función apply_day_changes disponible');
  else (problems++, fail(`Falta la función apply_day_changes: ejecuta supabase/migrations/0002_apply_day_changes.sql (${rpc.error.message})`));

  console.log('\n5. Seguridad (RLS)');
  const anon = createClient(url, key, { auth: { persistSession: false } });
  const { data: leaked } = await anon.from('day_activities').select('id').limit(1);
  if (!leaked?.length) ok('Sin sesión no se ve ningún dato');
  else (problems++, fail('¡Se ven datos sin sesión! Revisa el RLS'));

  await sb.auth.signOut();
  console.log(problems ? `\n⚠️  ${problems} problema(s). Pásale esta salida a Claude.\n` : '\n🎉 Todo conectado correctamente.\n');
  process.exit(problems ? 1 : 0);
}

main().catch((e) => {
  console.error('\n❌ Error inesperado:', e instanceof Error ? e.message : e);
  process.exit(1);
});
