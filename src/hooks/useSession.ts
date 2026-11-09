import { useEffect, useState } from 'react';

import { auth } from '@/data';

/** `undefined` mientras se lee la sesión guardada; `null` si no hay sesión. */
export function useSession() {
  const [session, setSession] = useState<auth.SessionInfo | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    auth.getSession().then((s) => alive && setSession(s));
    const off = auth.onSessionChange((s) => setSession(s));
    return () => {
      alive = false;
      off();
    };
  }, []);

  return session;
}
