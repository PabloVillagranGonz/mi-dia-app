// Edge Function `gcal-webhook`: Google avisa aquí (events.watch) cuando cambia un calendario.
// Responde enseguida y sincroniza en segundo plano (objetivo: verlo en la app en ≤ 30 s).
// Desplegar con --no-verify-jwt: lo llama Google; se valida con el id y el token del canal.

import { admin, background, isAllowed, syncUser } from '../_shared/gcal.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  const channelId = req.headers.get('X-Goog-Channel-ID');
  const token = req.headers.get('X-Goog-Channel-Token');
  const state = req.headers.get('X-Goog-Resource-State');
  if (!channelId || !token) return new Response(null, { status: 400 });

  const { data } = await admin
    .from('google_calendars')
    .select('user_id, channel_token')
    .eq('channel_id', channelId)
    .maybeSingle();
  // Canal desconocido o token falso: 200 igualmente para que Google no reintente sin fin
  if (!data || data.channel_token !== token || !(await isAllowed(data.user_id))) return new Response(null, { status: 200 });

  // «sync» es el primer aviso al crear el canal: no hay cambios
  if (state !== 'sync') background(syncUser(data.user_id));
  return new Response(null, { status: 200 });
});
