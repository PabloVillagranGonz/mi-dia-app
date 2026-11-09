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

export async function signOut(): Promise<void> {
  await clearReadCache().catch(() => {});
  if (supabase) await supabase.auth.signOut();
}
