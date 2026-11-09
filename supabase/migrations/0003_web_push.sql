-- Avisos Web Push para la versión web (PWA en el iPhone). Spec §4.5.
-- La Edge Function `push` llama cada minuto (pg_cron) a claim_due_push(), que devuelve los avisos
-- que tocan y los marca como enviados para no repetirlos.
-- Pegar en Supabase → SQL Editor → Run. El cron va aparte: 0004_push_cron.sql.

-- 1. Suscripciones: una por dispositivo/navegador
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;
drop policy if exists "own push subscriptions" on public.push_subscriptions;
create policy "own push subscriptions" on public.push_subscriptions for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 2. Registro de avisos enviados (solo lo usa la Edge Function con la clave de servicio)
create table if not exists public.push_log (
  user_id uuid not null references auth.users on delete cascade,
  key text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.push_log enable row level security; -- sin políticas: nadie desde la app

-- 3. Avisos pendientes en los últimos 3 minutos (margen por si el cron se retrasa).
--    Mismas reglas que src/domain/notifications.ts:
--    - al inicio de cada actividad con notify, «Hasta las HH:MM · Siguiente: X»
--    - la segunda mitad de una actividad que cruza medianoche no avisa
--    - recordatorio de planificación el día y hora de Ajustes
--    Solo para usuarios con notificaciones activadas y algún dispositivo suscrito.
create or replace function public.claim_due_push(p_now timestamptz default now())
returns table (user_id uuid, key text, title text, body text, url text)
language sql
security definer
set search_path = public
as $$
  delete from push_log where sent_at < p_now - interval '7 days';

  with
  local_now as (
    select (p_now at time zone 'Europe/Madrid') as ts
  ),
  s as (
    select st.user_id, st.planning_reminder_weekday, st.planning_reminder_time
    from settings st
    where st.notifications_enabled
      and exists (select 1 from push_subscriptions ps where ps.user_id = st.user_id)
  ),
  acts as (
    select a.*,
           ((a.date + a.start_time) at time zone 'Europe/Madrid') as starts_at
    from day_activities a
    join s on s.user_id = a.user_id
    cross join local_now
    where a.date between local_now.ts::date - 1 and local_now.ts::date + 1
  ),
  due_acts as (
    select a.user_id,
           'act:' || a.id || ':' || a.date as key,
           a.title,
           'Hasta las ' || case when a.end_time = time '24:00' then '00:00' else to_char(a.end_time, 'HH24:MI') end
             || coalesce(' · Siguiente: ' || nx.title, '') as body,
           '/' as url
    from acts a
    left join lateral (
      select b.title from acts b
      where b.user_id = a.user_id
        and b.starts_at > a.starts_at
        and (a.split_group_id is null or b.split_group_id is distinct from a.split_group_id)
      order by b.starts_at
      limit 1
    ) nx on true
    where a.notify
      and a.starts_at > p_now - interval '3 minutes'
      and a.starts_at <= p_now
      and not (
        a.start_time = time '00:00'
        and a.split_group_id is not null
        and exists (
          select 1 from day_activities c
          where c.split_group_id = a.split_group_id and c.end_time = time '24:00'
        )
      )
  ),
  due_plan as (
    select s.user_id,
           'plan:' || (local_now.ts::date)::text as key,
           'Planifica tu semana' as title,
           'Revisa la semana que viene y añade ensayos, bolos y citas.' as body,
           '/planificar' as url
    from s cross join local_now
    where extract(isodow from local_now.ts) = s.planning_reminder_weekday
      and ((local_now.ts::date + s.planning_reminder_time) at time zone 'Europe/Madrid') > p_now - interval '3 minutes'
      and ((local_now.ts::date + s.planning_reminder_time) at time zone 'Europe/Madrid') <= p_now
  ),
  due as (
    select * from due_acts
    union all
    select * from due_plan
  ),
  claimed as (
    insert into push_log (user_id, key)
    select d.user_id, d.key from due d
    on conflict do nothing
    returning push_log.user_id, push_log.key
  )
  select d.user_id, d.key, d.title, d.body, d.url
  from due d
  join claimed c on c.user_id = d.user_id and c.key = d.key;
$$;

revoke all on function public.claim_due_push(timestamptz) from public, anon, authenticated;
grant execute on function public.claim_due_push(timestamptz) to service_role;
