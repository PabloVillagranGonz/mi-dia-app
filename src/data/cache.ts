// Caché de lectura (spec §1): si no hay conexión, se devuelve la última lectura guardada.
// Solo lecturas; escribir sigue necesitando internet en la Fase 1.

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { Store } from './store';

const PREFIX = 'cache:v1:';

// ── Estado «sin conexión»: true mientras se esté mostrando lo guardado ──
let offline = false;
const offlineListeners = new Set<(v: boolean) => void>();

function setOffline(v: boolean) {
  if (offline === v) return;
  offline = v;
  offlineListeners.forEach((l) => l(v));
}

export function isOffline(): boolean {
  return offline;
}

export function onOfflineChange(l: (v: boolean) => void): () => void {
  offlineListeners.add(l);
  return () => {
    offlineListeners.delete(l);
  };
}

async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
  try {
    const value = await load();
    setOffline(false);
    AsyncStorage.setItem(PREFIX + key, JSON.stringify(value)).catch(() => {});
    return value;
  } catch (e) {
    const raw = await AsyncStorage.getItem(PREFIX + key).catch(() => null);
    if (raw != null) {
      setOffline(true);
      return JSON.parse(raw) as T;
    }
    throw e;
  }
}

export function withReadCache(store: Store): Store {
  return {
    ...store,
    listCategories: () => cached('categories', store.listCategories),
    listTemplates: () => cached('templates', store.listTemplates),
    getWeek: (w) => cached(`week:${w}`, () => store.getWeek(w)),
    listDayActivities: (from, to) => cached(`acts:${from}:${to}`, () => store.listDayActivities(from, to)),
    getSettings: () => cached('settings', store.getSettings),
  };
}

export async function clearReadCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(PREFIX)));
}
