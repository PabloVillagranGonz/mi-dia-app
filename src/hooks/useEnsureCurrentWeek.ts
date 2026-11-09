import { useEffect } from 'react';
import { AppState } from 'react-native';

import { repo } from '@/data';
import { localNow } from '@/domain/clock';
import { weekStartOf } from '@/domain/time';

/** Spec §4.1: al abrir la app y al volver a primer plano, si la semana actual no existe se genera. */
export function useEnsureCurrentWeek(enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const run = () => repo.ensureWeek(weekStartOf(localNow().date)).catch(() => {});
    run();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && run());
    return () => sub.remove();
  }, [enabled]);
}
