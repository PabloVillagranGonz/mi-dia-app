// Notificaciones locales (spec §4.5). Funcionan en Expo Go.
// Ventana móvil: hoy + mañana. Se reprograman al abrir, al volver a primer plano y tras cualquier cambio.

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { repo } from '@/data';
import { localNow } from '@/domain/clock';
import { planActivityNotifications, toExpoWeekday } from '@/domain/notifications';
import { addDays, toMinutes } from '@/domain/time';

const PLANNING_ID = 'planning-reminder';

// Mostrar también con la app abierta
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Pide permiso si aún no se ha decidido. Devuelve si está concedido. */
export async function ensurePermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return asked.granted;
}

export async function cancelAll(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

let running: Promise<void> | null = null;
let pending = false;

/** Recalcula y vuelve a programar todo. Si se llama varias veces seguidas, se agrupa. */
export function reschedule(): Promise<void> {
  if (running) {
    pending = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        pending = false;
        await doReschedule();
      } while (pending);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function doReschedule() {
  const settings = await repo.getSettings();
  if (!settings.notifications_enabled) {
    await cancelAll();
    return;
  }
  if (!(await ensurePermission())) return;

  const today = localNow().date;
  const acts = await repo.getRange(today, addDays(today, 1));
  const planned = planActivityNotifications(acts, new Date());

  await cancelAll();

  for (const n of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, sound: true, data: { url: '/' } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at },
    });
  }

  const t = toMinutes(settings.planning_reminder_time);
  await Notifications.scheduleNotificationAsync({
    identifier: PLANNING_ID,
    content: {
      title: 'Planifica tu semana',
      body: 'Revisa la semana que viene y añade ensayos, bolos y citas.',
      sound: true,
      data: { url: '/planificar' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: toExpoWeekday(settings.planning_reminder_weekday),
      hour: Math.floor(t / 60),
      minute: t % 60,
    },
  });
}

/** Notificación de prueba en 5 segundos (botón de Ajustes). */
export async function sendTest(): Promise<boolean> {
  if (!(await ensurePermission())) return false;
  await Notifications.scheduleNotificationAsync({
    content: { title: 'Mi Día', body: 'Las notificaciones funcionan ✅', sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5 },
  });
  return true;
}

export async function scheduledCount(): Promise<number> {
  return (await Notifications.getAllScheduledNotificationsAsync()).length;
}

/**
 * Mantiene las notificaciones al día mientras haya sesión
 * y abre la pantalla correspondiente al tocar una.
 */
export function useNotifications(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    reschedule().catch(() => {});
    let timer: ReturnType<typeof setTimeout> | undefined;
    const debounced = () => {
      clearTimeout(timer);
      timer = setTimeout(() => reschedule().catch(() => {}), 800);
    };
    const off = repo.subscribe(debounced);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && debounced());
    return () => {
      clearTimeout(timer);
      off();
      sub.remove();
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    const open = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === 'string' && url !== '/') router.push(url as '/planificar');
      Notifications.clearLastNotificationResponse();
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, [enabled]);
}
