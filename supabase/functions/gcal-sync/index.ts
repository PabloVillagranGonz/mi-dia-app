// Edge Function `gcal-sync`: trae los cambios de Google Calendar y rehace los días afectados.
//
// - Cron (pg_cron cada 15 min, cabecera x-cron-secret): todos los usuarios conectados y permitidos.
//   Es el respaldo si un aviso de Google se pierde; también renueva los canales y cambia de semana.
// - App (sesión del usuario), tras cambiar los calendarios en Ajustes: solo ese usuario.
// Desplegar con --no-verify-jwt.

import { admin, cors, isAllowed, isCron, json, sessionUser, syncUser } from '../_shared/gcal.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Usa POST' }, 405);

  try {
    if (isCron(req)) {
      const { data, error } = await admin.from('google_accounts').select('user_id');
      if (error) throw error;
      const ids = (data ?? []).map((r) => r.user_id as string);
      const users = [];
      for (const u of ids) if (await isAllowed(u)) users.push(u);
      const results = [];
      for (const u of users) results.push({ user: u, ...(await syncUser(u)) });
      return json({ users: results.length, results });
    }

    const userId = await sessionUser(req);
    if (!userId) return json({ error: 'Sin sesión' }, 401);
    if (!(await isAllowed(userId))) return json({ allowed: false }, 403);
    return json(await syncUser(userId));
  } catch (e) {
    console.error('gcal-sync', e);
    return json({ error: (e as Error).message }, 500);
  }
});
