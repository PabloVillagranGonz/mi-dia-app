// Web Push en la versión web (PWA). Solo se importa desde código .web.
// En iPhone exige iOS 16.4+ y que la app esté añadida a la pantalla de inicio.

import { push } from '@/data';

/** Clave pública VAPID (la privada está en los secretos de la Edge Function `push`). Es pública por diseño. */
export const VAPID_PUBLIC_KEY = 'BAWn6GANJ1lxVfn6Ada-nXYIi5O_D7RmGfGAUfSYdTiQI_vOyr7RgQZlqQmpkjQj-cC-4_tH9caw5mE6YAbK5Yo';

export type WebPushState =
  | 'unsupported' // navegador sin Web Push
  | 'install' // iPhone en Safari: hay que añadirla a la pantalla de inicio
  | 'default' // aún no se ha pedido permiso (o no hay suscripción en este dispositivo)
  | 'denied' // permiso denegado: solo se cambia desde Ajustes del iPhone
  | 'enabled'; // permiso concedido y dispositivo suscrito

const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
const hasPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  return navigator.serviceWorker.register('/sw.js').catch(() => null);
}

async function currentSubscription(): Promise<PushSubscription | null> {
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

export async function getWebPushState(): Promise<WebPushState> {
  if (!hasPush()) return isIOS() && !isStandalone() ? 'install' : 'unsupported';
  if (Notification.permission === 'denied') return 'denied';
  if (Notification.permission !== 'granted') return 'default';
  return (await currentSubscription()) ? 'enabled' : 'default';
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = (base64url + '='.repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function toKeys(sub: PushSubscription) {
  const json = sub.toJSON();
  return { endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '' };
}

/** Crea (o reutiliza) la suscripción de este dispositivo y la guarda en Supabase. Requiere permiso concedido. */
async function subscribeAndSave(): Promise<void> {
  const reg = (await registerServiceWorker()) ?? (await navigator.serviceWorker.ready);
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    // Si se creó con otra clave VAPID, no sirve: se rehace
    const key = sub.options.applicationServerKey;
    const same = key && new Uint8Array(key).join(',') === keyToBytes(VAPID_PUBLIC_KEY).join(',');
    if (!same) {
      await sub.unsubscribe().catch(() => {});
      sub = null;
    }
  }
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(VAPID_PUBLIC_KEY) });
  }
  await push.saveSubscription(toKeys(sub), navigator.userAgent);
}

/**
 * Pide permiso y suscribe este dispositivo. Llamar directamente desde un toque del usuario:
 * iOS solo muestra la petición de permiso si viene de un gesto.
 */
export async function enableWebPush(): Promise<WebPushState> {
  if (!hasPush()) return getWebPushState();
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return getWebPushState();
  await subscribeAndSave();
  return 'enabled';
}

/** Al abrir la app: si ya hay permiso, refresca la suscripción (el endpoint puede cambiar). */
export async function refreshWebPush(): Promise<void> {
  if (!hasPush() || Notification.permission !== 'granted') return;
  await subscribeAndSave();
}

/** Al cerrar sesión: este dispositivo deja de recibir avisos. */
export async function disableWebPush(): Promise<void> {
  if (!hasPush()) return;
  const sub = await currentSubscription();
  if (!sub) return;
  await push.deleteSubscription(sub.endpoint).catch(() => {});
  await sub.unsubscribe().catch(() => {});
}
