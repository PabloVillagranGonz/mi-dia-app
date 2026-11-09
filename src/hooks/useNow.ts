import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { localNow, type LocalNow } from '@/domain/clock';

/** Hora local de Madrid, refrescada cada `intervalMs` (30 s por spec) y al volver a primer plano. */
export function useNow(intervalMs = 30_000): LocalNow {
  const [now, setNow] = useState(() => localNow());
  useEffect(() => {
    const tick = () => setNow(localNow());
    const id = setInterval(tick, intervalMs);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && tick());
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [intervalMs]);
  return now;
}
