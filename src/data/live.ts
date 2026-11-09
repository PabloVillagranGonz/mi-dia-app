// Cambios hechos fuera de la app (el servidor sincronizando Google Calendar, otro dispositivo…):
// Supabase Realtime avisa y las vistas se recargan. Sin Supabase no hace nada.

import { supabase } from '@/lib/supabase';

/** Llama a `onChange` (agrupado, como mucho una vez por segundo) cuando cambian las actividades del usuario. */
export function subscribeRemoteChanges(onChange: () => void): () => void {
  if (!supabase) return () => {};
  const sb = supabase;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const channel = sb
    .channel('day_activities')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'day_activities' }, () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        onChange();
      }, 1000);
    })
    .subscribe();
  return () => {
    if (timer) clearTimeout(timer);
    sb.removeChannel(channel);
  };
}
