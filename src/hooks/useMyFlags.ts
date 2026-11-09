import { useEffect, useState } from 'react';

import { myFlags, NO_FLAGS, type UserFlags } from '@/data';
import { useSession } from './useSession';

/** Qué es el usuario de la sesión (admin, demo…). Se vuelve a leer al cambiar de sesión. */
export function useMyFlags(): UserFlags {
  const session = useSession();
  const email = session?.email ?? null;
  const [flags, setFlags] = useState<{ email: string | null; value: UserFlags }>({ email: null, value: NO_FLAGS });

  useEffect(() => {
    let alive = true;
    myFlags().then((value) => alive && setFlags({ email, value }));
    return () => {
      alive = false;
    };
  }, [email]);

  // Mientras llegan los de la sesión nueva, nada de permisos de la anterior
  return flags.email === email ? flags.value : NO_FLAGS;
}
