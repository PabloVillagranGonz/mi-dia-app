// Suscripciones Web Push (versión web). Solo las usa src/notifications/index.web.ts.
// Sin Supabase (datos de prueba) no hacen nada.

import { supabase } from '@/lib/supabase';
import { UserError } from './errors';

export interface PushSubscriptionKeys {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Guarda (o refresca) la suscripción de este dispositivo. */
export async function saveSubscription(sub: PushSubscriptionKeys, userAgent?: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({ ...sub, user_agent: userAgent ?? null, last_seen_at: new Date().toISOString() }, { onConflict: 'endpoint' });
  if (error) throw new UserError(`No se pudo guardar el dispositivo: ${error.message}`);
}

export async function deleteSubscription(endpoint: string): Promise<void> {
  if (!supabase) return;
  await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
}

/** Pide a la Edge Function `push` un aviso de prueba a los dispositivos del usuario. Devuelve cuántos se enviaron. */
export async function sendTest(): Promise<number> {
  if (!supabase) throw new UserError('Con datos de prueba no hay avisos.');
  const { data, error } = await supabase.functions.invoke('push', { body: { test: true } });
  if (error) throw new UserError(`No se pudo enviar la prueba: ${error.message}`);
  return (data as { sent?: number })?.sent ?? 0;
}
