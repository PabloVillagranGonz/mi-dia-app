// Qué es el usuario de la sesión (admin, demo…): tabla user_flags, que solo escribe el servidor.

import { supabase } from '@/lib/supabase';
import type { UserFlags } from './types';

export const NO_FLAGS: UserFlags = { is_admin: false, is_demo: false, gcal_allowed: false };

export async function myFlags(): Promise<UserFlags> {
  if (!supabase) return NO_FLAGS;
  const { data, error } = await supabase.from('user_flags').select('is_admin, is_demo, gcal_allowed').maybeSingle();
  if (error || !data) return NO_FLAGS; // sin fila, sin conexión o migración 0008 sin ejecutar
  return data as UserFlags;
}
