// Google Calendar (issue #1): cliente de las Edge Functions gcal-*. Solo para usuarios permitidos.
// Sin Supabase (datos de prueba) no hay nada que conectar.

import { supabase } from '@/lib/supabase';
import { UserError } from './errors';
import type { GoogleCalendarPatch } from './store';
import type { GoogleCalendar } from './types';

export interface GoogleStatus {
  connected: boolean;
  email: string | null;
  calendars: GoogleCalendar[];
}

/** null si este usuario no tiene la función (o no hay Supabase): la sección no se muestra. */
export async function status(): Promise<GoogleStatus | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.functions.invoke('gcal-oauth/status', { method: 'GET' });
  if (error) return null; // 403 (no permitido), función sin desplegar o sin conexión
  return data?.allowed ? (data as GoogleStatus) : null;
}

/** Dirección de la pantalla de permisos de Google (abrirla en esta misma ventana). */
export async function connectUrl(): Promise<string> {
  if (!supabase) throw new UserError('Con datos de prueba no se puede conectar.');
  const { data, error } = await supabase.functions.invoke('gcal-oauth/start', { method: 'POST' });
  if (error || !data?.url) throw new UserError('No se pudo empezar la conexión con Google.');
  return data.url as string;
}

export async function disconnect(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.functions.invoke('gcal-oauth/disconnect', { method: 'POST' });
  if (error) throw new UserError('No se pudo desconectar. Inténtalo de nuevo.');
}

export async function updateCalendar(id: string, patch: GoogleCalendarPatch): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('google_calendars').update(patch).eq('id', id);
  if (error) throw new UserError(`No se pudo guardar: ${error.message}`);
}

/** Sincroniza ahora (tras cambiar los calendarios). Devuelve cuántas actividades cambiaron. */
export async function syncNow(): Promise<number> {
  if (!supabase) return 0;
  const { data, error } = await supabase.functions.invoke('gcal-sync', { method: 'POST', body: {} });
  if (error) throw new UserError('No se pudo sincronizar con Google.');
  return (data as { changes?: number })?.changes ?? 0;
}

/** Mensaje para ?google=error&reason=… al volver de Google. */
export function connectErrorMessage(reason: string | null): string {
  switch (reason) {
    case 'access_denied':
      return 'Cancelaste el permiso en Google.';
    case 'scope':
      return 'Hace falta marcar el permiso de ver tus calendarios.';
    case 'state':
      return 'El enlace de conexión caducó. Vuelve a intentarlo.';
    default:
      return 'No se pudo conectar con Google. Vuelve a intentarlo.';
  }
}
