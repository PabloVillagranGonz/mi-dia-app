import { useEffect } from 'react';

import { repo, subscribeRemoteChanges } from '@/data';

/** Recarga las vistas cuando el servidor cambia las actividades (p. ej. al sincronizar Google Calendar). */
export function useRemoteChanges(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    return subscribeRemoteChanges(() => repo.refresh());
  }, [enabled]);
}
