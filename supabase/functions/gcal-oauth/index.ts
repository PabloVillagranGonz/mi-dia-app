// Edge Function `gcal-oauth`: conectar y desconectar Google Calendar (issue #1).
//
//   POST /start       (sesión)  → { url } de la pantalla de permisos de Google
//   GET  /callback    (Google)  → guarda el permiso y vuelve a {APP_URL}/ajustes?google=ok|error
//   GET  /status      (sesión)  → { allowed, connected, email, calendars }
//   POST /disconnect  (sesión)  → revoca, borra y restaura la rutina
//
// Google vuelve a https://<app>/api/gcal/callback, que Vercel reenvía aquí (vercel.json).
// Desplegar con --no-verify-jwt: /callback llega sin sesión y el resto la comprueba este código.

import {
  admin,
  background,
  cors,
  disconnect,
  env,
  importCalendars,
  isAllowed,
  json,
  redirectUri,
  SCOPES,
  sessionUser,
  signState,
  syncUser,
  tokenRequest,
  verifyState,
} from '../_shared/gcal.ts';

const back = (result: 'ok' | 'error', reason?: string) =>
  Response.redirect(`${env('APP_URL')}/ajustes?google=${result}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`, 302);

/** Payload del id_token (viene de Google por TLS en el canje: no hace falta verificar la firma). */
function idTokenEmail(idToken: string | undefined): string | null {
  if (!idToken) return null;
  try {
    const p = idToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p)).email ?? null;
  } catch {
    return null;
  }
}

async function callback(url: URL): Promise<Response> {
  if (url.searchParams.get('error')) return back('error', url.searchParams.get('error')!); // p. ej. access_denied
  const userId = await verifyState(url.searchParams.get('state') ?? '');
  if (!userId || !isAllowed(userId)) return back('error', 'state');
  const code = url.searchParams.get('code');
  if (!code) return back('error', 'code');

  let tokens: Record<string, string>;
  try {
    tokens = await tokenRequest({ grant_type: 'authorization_code', code, redirect_uri: redirectUri() });
  } catch (e) {
    console.error('gcal callback token', (e as Error).message);
    return back('error', 'token');
  }
  // En la pantalla de Google se puede desmarcar el calendario: sin él no hay nada que hacer
  if (!(tokens.scope ?? '').includes('calendar.readonly')) return back('error', 'scope');
  if (!tokens.refresh_token) return back('error', 'refresh');

  const { error } = await admin.from('google_accounts').upsert({
    user_id: userId,
    google_email: idTokenEmail(tokens.id_token) ?? '(desconocido)',
    refresh_token: tokens.refresh_token,
    connected_at: new Date().toISOString(),
  });
  if (error) {
    console.error('gcal callback save', error.message);
    return back('error', 'save');
  }
  try {
    await importCalendars(userId, tokens.access_token);
  } catch (e) {
    console.error('gcal callback calendars', (e as Error).message);
    return back('error', 'calendars');
  }
  background(syncUser(userId)); // primera sincronización sin hacer esperar
  return back('ok');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const url = new URL(req.url);
  const route = url.pathname.split('/').filter(Boolean).pop();

  try {
    if (route === 'callback' && req.method === 'GET') return await callback(url);

    const userId = await sessionUser(req);
    if (!userId) return json({ error: 'Sin sesión' }, 401);
    if (!isAllowed(userId)) return json({ allowed: false }, 403);

    if (route === 'start' && req.method === 'POST') {
      const q = new URLSearchParams({
        client_id: env('GOOGLE_CLIENT_ID'),
        redirect_uri: redirectUri(),
        response_type: 'code',
        scope: SCOPES,
        access_type: 'offline',
        prompt: 'consent', // para que Google devuelva siempre el refresh token
        include_granted_scopes: 'true',
        state: await signState(userId),
      });
      return json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${q}` });
    }

    if (route === 'status' && req.method === 'GET') {
      const { data: account } = await admin
        .from('google_accounts')
        .select('google_email, connected_at')
        .eq('user_id', userId)
        .maybeSingle();
      const { data: calendars } = await admin
        .from('google_calendars')
        .select('id, calendar_id, summary, color, enabled, category_id, kind, notify, hidden')
        .eq('user_id', userId)
        .order('summary');
      return json({
        allowed: true,
        connected: Boolean(account),
        email: account?.google_email ?? null,
        calendars: account ? (calendars ?? []) : [],
      });
    }

    if (route === 'disconnect' && req.method === 'POST') {
      await disconnect(userId);
      return json({ ok: true });
    }

    return json({ error: 'Ruta no encontrada' }, 404);
  } catch (e) {
    console.error('gcal-oauth', e);
    return json({ error: (e as Error).message }, 500);
  }
});
