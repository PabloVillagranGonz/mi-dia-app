// Sesión: email + contraseña con Supabase. Sin Supabase (datos de prueba) no hay login.

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { clearReadCache } from './cache';
import { UserError } from './errors';

export interface SessionInfo {
  email: string;
}

export const authEnabled = isSupabaseConfigured;

export async function getSession(): Promise<SessionInfo | null> {
  if (!supabase) return { email: 'datos de prueba' };
  const { data } = await supabase.auth.getSession();
  return data.session ? { email: data.session.user.email ?? '' } : null;
}

export function onSessionChange(cb: (s: SessionInfo | null) => void): () => void {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    cb(session ? { email: session.user.email ?? '' } : null);
  });
  return () => data.subscription.unsubscribe();
}

export async function signIn(email: string, password: string): Promise<void> {
  if (!supabase) return;
  if (!email.trim() || !password) throw new UserError('Escribe tu email y tu contraseña.');
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) throw new UserError('Email o contraseña incorrectos.');
    if (/network|fetch/i.test(error.message)) throw new UserError('Sin conexión. Inténtalo de nuevo.');
    throw new UserError(error.message);
  }
}

/** Cuenta de demostración pública (portfolio). Si no está configurada, no se ofrece. */
const DEMO_EMAIL = process.env.EXPO_PUBLIC_DEMO_EMAIL;
const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD;
export const demoAvailable = Boolean(supabase && DEMO_EMAIL && DEMO_PASSWORD);

export async function signInDemo(): Promise<void> {
  if (!demoAvailable) return;
  try {
    await signIn(DEMO_EMAIL!, DEMO_PASSWORD!);
  } catch (e) {
    if (e instanceof UserError && /incorrectos/.test(e.message)) {
      throw new UserError('La demo se está restableciendo. Prueba de nuevo en un minuto.');
    }
    throw e;
  }
}

export async function signOut(): Promise<void> {
  await clearReadCache().catch(() => {});
  // Sin sesión no debe quedar ningún aviso programado
  const { cancelAll } = await import('@/notifications');
  await cancelAll().catch(() => {});
  if (supabase) await supabase.auth.signOut();
}
