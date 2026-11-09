import { useEffect, useState } from 'react';

import { isOffline, onOfflineChange } from '@/data';

/** true cuando la app está mostrando datos guardados porque no hay conexión con Supabase. */
export function useOffline(): boolean {
  const [offline, setOffline] = useState(isOffline());
  useEffect(() => onOfflineChange(setOffline), []);
  return offline;
}
