// Notificaciones en la versión web (PWA): Web Push enviado por la Edge Function `push` de Supabase
// (pg_cron cada minuto). Aquí no se programa nada en el dispositivo: el servidor decide cuándo avisar.
// Misma interfaz que index.ts; el panel de Ajustes está en components/WebPushSettings.web.tsx.

import { useEffect } from 'react';

import { push } from '@/data';
import { disableWebPush, refreshWebPush, registerServiceWorker } from './webPush';

/** En la web no hay botón de prueba local ni recuento: lo sustituye WebPushSettings. */
export const notificationsSupported = false;

export async function ensurePermission(): Promise<boolean> {
  return typeof Notification !== 'undefined' && Notification.permission === 'granted';
}

/** Se llama al cerrar sesión. */
export async function cancelAll(): Promise<void> {
  await disableWebPush();
}

export async function reschedule(): Promise<void> {}

export async function sendTest(): Promise<boolean> {
  return (await push.sendTest()) > 0;
}

export async function scheduledCount(): Promise<number> {
  return 0;
}

/** Con sesión: registra el service worker y mantiene al día la suscripción de este dispositivo. */
export function useNotifications(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    registerServiceWorker()
      .then(() => refreshWebPush())
      .catch(() => {});
  }, [enabled]);
}
