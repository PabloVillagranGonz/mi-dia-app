// Panel de administración: cliente de la Edge Function `admin` (solo responde a administradores).

import type { UserStats } from '@/domain/stats';
import { supabase } from '@/lib/supabase';
import { UserError } from './errors';
import type { AdminUser, Category } from './types';

export interface AdminStats {
  from: string;
  today: string;
  stats: UserStats;
  categories: Pick<Category, 'id' | 'name' | 'color'>[];
}

export interface DemoStatus {
  configured: boolean;
  email: string | null;
  users: number;
}

export interface AdminOverview {
  week_start: string;
  users: number;
  active_7d: number;
  disabled: number;
  devices: number;
  recent: { id: string; email: string; created_at: string }[];
  tasks: { done: number; total: number };
  ranking: { id: string; email: string; done: number; total: number }[];
  demo: { email: string; last_sign_in_at: string | null } | null;
}

export interface AdminGoogleUser {
  id: string;
  email: string;
  allowed: boolean;
  google_email: string | null;
  connected_at: string | null;
  calendars: string[];
  events: number;
  channel_expires_at: string | null;
}

export interface CronJobStatus {
  jobname: string;
  schedule: string;
  active: boolean;
  last_start: string | null;
  last_status: string | null;
  last_message: string | null;
  failures_24h: number;
  runs_24h: number;
}

export interface SystemStatus {
  jobs: CronJobStatus[];
  http: { total: number; errors: number; last_error: { at: string; status: number | null; message: string } | null };
  push_sent_today: number;
  push_devices: number;
  checked_at: string;
}

async function call<T>(path: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  if (!supabase) throw new UserError('Con datos de prueba no hay administración.');
  const { data, error } = await supabase.functions.invoke(`admin/${path}`, { method, body: method === 'POST' ? (body ?? {}) : undefined });
  if (error) {
    // El mensaje útil viene en el cuerpo de la respuesta: {"error": "…"}
    const ctx = (error as { context?: Response }).context;
    const msg = await ctx?.json?.().then((j: { error?: string }) => j.error).catch(() => null);
    throw new UserError(msg ?? 'No se pudo completar. Comprueba la conexión.');
  }
  return data as T;
}

export const listUsers = () => call<{ users: AdminUser[] }>('users', 'GET').then((r) => r.users);
export const createUser = (email: string, password: string) => call<{ id: string }>('users', 'POST', { email, password });
export const setPassword = (id: string, password: string) => call('user/password', 'POST', { id, password });
export const setDisabled = (id: string, disabled: boolean) => call('user/disabled', 'POST', { id, disabled });
export const deleteUser = (id: string) => call('user/delete', 'POST', { id });
export const setGoogle = (id: string, allowed: boolean) => call('user/google', 'POST', { id, allowed });
export const userStats = (id: string, weeks = 8) => call<AdminStats>(`user/stats?id=${id}&weeks=${weeks}`, 'GET');
export const overview = () => call<AdminOverview>('overview', 'GET');
export const googleUsers = () => call<{ users: AdminGoogleUser[] }>('google', 'GET').then((r) => r.users);
export const system = () => call<SystemStatus>('system', 'GET');
export const demoStatus = () => call<DemoStatus>('demo', 'GET');
export const resetDemo = () => call<{ reset: number; email: string }>('demo-reset', 'POST');

/** Contraseña aleatoria legible (sin caracteres que se confundan: 0/O, 1/l/I). */
export function randomPassword(length = 12): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => chars[b % chars.length]).join('');
}
