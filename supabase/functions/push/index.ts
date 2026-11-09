// Edge Function `push`: envía los avisos Web Push de la versión web (PWA).
//
// Dos formas de llamarla:
// - Cron (cada minuto, desde pg_cron): cabecera `x-cron-secret`. Envía lo que devuelva claim_due_push().
// - Prueba (botón de Ajustes): con la sesión del usuario (Authorization: Bearer <jwt>) y body {"test": true}.
//
// Secretos (Supabase → Edge Functions → Secrets): VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET.
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los pone Supabase.
// Desplegar sin verificación de JWT (la comprobación la hace este código).

import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

interface Message {
  user_id: string;
  key: string;
  title: string;
  body: string;
  url: string;
}

interface SubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const env = (name: string): string => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Falta el secreto ${name}`);
  return v;
};

const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
});

webpush.setVapidDetails(env('VAPID_SUBJECT'), env('VAPID_PUBLIC_KEY'), env('VAPID_PRIVATE_KEY'));

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

/** Envía cada mensaje a todos los dispositivos de su usuario. Borra las suscripciones caducadas. */
async function deliver(messages: Message[]): Promise<{ sent: number; failed: number; removed: number }> {
  const result = { sent: 0, failed: 0, removed: 0 };
  if (!messages.length) return result;

  const userIds = [...new Set(messages.map((m) => m.user_id))];
  const { data, error } = await admin.from('push_subscriptions').select('*').in('user_id', userIds);
  if (error) throw error;
  const subs = (data ?? []) as SubscriptionRow[];

  const gone = new Set<string>();
  await Promise.all(
    messages.flatMap((m) =>
      subs
        .filter((s) => s.user_id === m.user_id)
        .map(async (s) => {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              JSON.stringify({ title: m.title, body: m.body, url: m.url, tag: m.key }),
              // Si el móvil no está conectado, el aviso caduca a los 10 min (ya no tendría sentido)
              { TTL: 600, urgency: 'high' },
            );
            result.sent++;
          } catch (e) {
            const status = (e as { statusCode?: number }).statusCode;
            if (status === 404 || status === 410) gone.add(s.id);
            else {
              result.failed++;
              console.error('push error', status, (e as Error).message);
            }
          }
        }),
    ),
  );

  if (gone.size) {
    await admin.from('push_subscriptions').delete().in('id', [...gone]);
    result.removed = gone.size;
  }
  return result;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    // Cron
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (cronSecret && req.headers.get('x-cron-secret') === cronSecret) {
      const { data, error } = await admin.rpc('claim_due_push');
      if (error) throw error;
      const messages = (data ?? []) as Message[];
      const result = await deliver(messages);
      return json({ due: messages.length, ...result });
    }

    // Prueba desde Ajustes, con la sesión del usuario
    const jwt = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!jwt) return json({ error: 'No autorizado' }, 401);
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    if (userError || !userData.user) return json({ error: 'No autorizado' }, 401);

    const body = await req.json().catch(() => ({}));
    if (!body?.test) return json({ error: 'Petición no válida' }, 400);

    const result = await deliver([
      {
        user_id: userData.user.id,
        key: `test:${Date.now()}`,
        title: 'Mi Día',
        body: 'Las notificaciones funcionan ✅',
        url: '/ajustes',
      },
    ]);
    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message }, 500);
  }
});
