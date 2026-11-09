import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { errorMessage, repo } from '@/data';

/**
 * Lee datos del repositorio y vuelve a leer cuando hay cambios o la app vuelve a primer plano.
 * `key` identifica la consulta: si cambia (otra fecha, otra semana…), se recarga.
 */
export function useRepoQuery<T>(load: () => Promise<T>, key: string) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      const value = await loadRef.current();
      setData(value);
      setError(null);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const off = repo.subscribe(refresh);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    return () => {
      off();
      sub.remove();
    };
  }, [key, refresh]);

  return { data, error, loading, refresh };
}
