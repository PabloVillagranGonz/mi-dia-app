import { useEffect, useState } from 'react';

import { myFlags, NO_FLAGS, type UserFlags } from '@/data';
import { useSession } from './useSession';

/**
 * Qué es el usuario de la sesión (admin, demo…). Se vuelve a leer al cambiar de sesión.
 * `loaded` es false mientras llegan los de la sesión actual (para no enseñar la pantalla equivocada).
 */
export function useMyFlagsState(): { flags: UserFlags; loaded: boolean } {
  const session = useSession();
  const email = session?.email ?? null;
  const [state, setState] = useState<{ email: string | null; value: UserFlags } | null>(null);

  useEffect(() => {
    let alive = true;
    myFlags().then((value) => alive && setState({ email, value }));
    return () => {
      alive = false;
    };
  }, [email]);

  // Mientras llegan los de la sesión nueva, nada de permisos de la anterior
  const current = state?.email === email ? state : null;
  return { flags: current?.value ?? NO_FLAGS, loaded: current !== null };
}

export function useMyFlags(): UserFlags {
  return useMyFlagsState().flags;
}
