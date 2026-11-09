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
  useEffect(() => {
    loadRef.current = load;
  });

  // Otra consulta (otra fecha, otra semana…): vuelve a «cargando» sin esperar a un efecto
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setLoading(true);
  }

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
