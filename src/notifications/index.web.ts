// En la web (PWA) aún no hay notificaciones: las locales de expo-notifications no existen allí.
// Se añadirán con Web Push (Supabase Edge Functions + pg_cron). Misma interfaz que index.ts.

export const notificationsSupported = false;

export async function ensurePermission(): Promise<boolean> {
  return false;
}

export async function cancelAll(): Promise<void> {}

export async function reschedule(): Promise<void> {}

export async function sendTest(): Promise<boolean> {
  return false;
}

export async function scheduledCount(): Promise<number> {
  return 0;
}

export function useNotifications(_enabled: boolean): void {}
