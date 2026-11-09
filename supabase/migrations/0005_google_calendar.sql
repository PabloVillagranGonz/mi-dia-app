-- Mi Día — 0005: sincronización Google Calendar → Mi Día (issue #1). Solo lectura de Google.
-- Pegar en Supabase → SQL Editor → Run (o `npx supabase db query --remote=… -f …`).
-- El cron va aparte: 0006_gcal_cron.sql.
--
-- Tokens y canales solo los ve el servidor (Edge Functions con la clave de servicio).

-- ─────────────────────────────────────────────────────────────
-- 1. Cuenta de Google conectada (refresh token): nadie desde la app
-- ─────────────────────────────────────────────────────────────
create table if not exists public.google_accounts (
  user_id uuid primary key references auth.users on delete cascade,
  google_email text not null,
  refresh_token text not null,
  connected_at timestamptz not null default now(),
  -- Cerrojo para que dos sincronizaciones del mismo usuario no se pisen
  sync_lock_until timestamptz,
  sync_again boolean not null default false
);
alter table public.google_accounts enable row level security; -- sin políticas
revoke all on public.google_accounts from anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- 2. Calendarios del usuario y cómo se traen
-- ─────────────────────────────────────────────────────────────
create table if not exists public.google_calendars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  calendar_id text not null,
  summary text not null,
  color text,
  enabled boolean not null default false,
  category_id uuid references public.categories on delete set null,
  kind text not null default 'task' check (kind in ('task','fixed')),
  notify boolean not null default true,
  -- Solo servidor:
  sync_token text,
  sync_window_start date,          -- lunes de la ventana del último sync completo
  channel_id text,
  channel_resource_id text,
  channel_token text,
  channel_expires_at timestamptz,
  unique (user_id, calendar_id)
);
create index if not exists google_calendars_channel_idx on public.google_calendars (channel_id) where channel_id is not null;

alter table public.google_calendars enable row level security;
drop policy if exists "own calendars read" on public.google_calendars;
drop policy if exists "own calendars update" on public.google_calendars;
create policy "own calendars read" on public.google_calendars for select to authenticated
  using (user_id = (select auth.uid()));
create policy "own calendars update" on public.google_calendars for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Permisos por columna: el usuario lee lo suyo sin tokens y solo cambia sus preferencias.
-- (Revocar la tabla entera primero: un permiso de tabla taparía los de columna.)
revoke all on public.google_calendars from anon, authenticated;
grant select (id, user_id, calendar_id, summary, color, enabled, category_id, kind, notify)
  on public.google_calendars to authenticated;
grant update (enabled, category_id, kind, notify) on public.google_calendars to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 3. Eventos sincronizados: una fila por evento y día (si cruza medianoche, dos)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.google_events (
  user_id uuid not null references auth.users on delete cascade,
  calendar_id text not null,
  event_id text not null,
  date date not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  updated timestamptz not null,
  primary key (user_id, calendar_id, event_id, date),
  check (end_time > start_time)
);
create index if not exists google_events_user_date_idx on public.google_events (user_id, date);

alter table public.google_events enable row level security;
drop policy if exists "own google events read" on public.google_events;
create policy "own google events read" on public.google_events for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.google_events from anon, authenticated;
grant select on public.google_events to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 4. Marca de origen en las actividades del día
-- ─────────────────────────────────────────────────────────────
alter table public.day_activities add column if not exists external_id text;  -- 'gcal:<calendar_id>:<event_id>'
create index if not exists day_activities_external_idx on public.day_activities (user_id, external_id)
  where external_id is not null;

-- ─────────────────────────────────────────────────────────────
-- 5. apply_day_changes con external_id, y versión para el servidor
-- ─────────────────────────────────────────────────────────────
-- apply_day_changes_as: mismo cuerpo, con el usuario explícito. security invoker: con la clave
-- de servicio salta el RLS (servidor); desde la app el RLS impide tocar filas de otro.
create or replace function public.apply_day_changes_as(
  p_user uuid,
  p_delete uuid[] default '{}',
  p_update jsonb default '[]',
  p_insert jsonb default '[]'
)
returns setof public.day_activities
language plpgsql
security invoker
set search_path = ''
as $$
declare
  u jsonb;
begin
  if p_user is null then
    raise exception 'No hay sesión';
  end if;

  if coalesce(array_length(p_delete, 1), 0) > 0 then
    delete from public.day_activities where id = any(p_delete) and user_id = p_user;
  end if;

  for u in select * from jsonb_array_elements(coalesce(p_update, '[]'::jsonb)) loop
    update public.day_activities
       set start_time = (u->>'start_time')::time,
           end_time   = (u->>'end_time')::time
     where id = (u->>'id')::uuid and user_id = p_user;
  end loop;

  return query
  insert into public.day_activities (
    user_id, week_id, date, start_time, end_time, title, category_id, kind, origin,
    template_activity_id, split_group_id, notify, edited, done, done_at, note, external_id
  )
  select
    p_user,
    (r->>'week_id')::uuid,
    (r->>'date')::date,
    (r->>'start_time')::time,
    (r->>'end_time')::time,
    r->>'title',
    nullif(r->>'category_id', '')::uuid,
    r->>'kind',
    r->>'origin',
    nullif(r->>'template_activity_id', '')::uuid,
    nullif(r->>'split_group_id', '')::uuid,
    coalesce((r->>'notify')::boolean, true),
    coalesce((r->>'edited')::boolean, false),
    coalesce((r->>'done')::boolean, false),
    nullif(r->>'done_at', '')::timestamptz,
    r->>'note',
    nullif(r->>'external_id', '')
  from jsonb_array_elements(coalesce(p_insert, '[]'::jsonb)) as r
  returning *;
end;
$$;

revoke all on function public.apply_day_changes_as(uuid, uuid[], jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.apply_day_changes_as(uuid, uuid[], jsonb, jsonb) to service_role;

-- La de la app: igual que en 0002, ahora con external_id. Se ejecuta como el usuario (RLS).
create or replace function public.apply_day_changes(
  p_delete uuid[] default '{}',
  p_update jsonb default '[]',
  p_insert jsonb default '[]'
)
returns setof public.day_activities
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  u jsonb;
begin
  if uid is null then
    raise exception 'No hay sesión';
  end if;

  if coalesce(array_length(p_delete, 1), 0) > 0 then
    delete from public.day_activities where id = any(p_delete) and user_id = uid;
  end if;

  for u in select * from jsonb_array_elements(coalesce(p_update, '[]'::jsonb)) loop
    update public.day_activities
       set start_time = (u->>'start_time')::time,
           end_time   = (u->>'end_time')::time
     where id = (u->>'id')::uuid and user_id = uid;
  end loop;

  return query
  insert into public.day_activities (
    user_id, week_id, date, start_time, end_time, title, category_id, kind, origin,
    template_activity_id, split_group_id, notify, edited, done, done_at, note, external_id
  )
  select
    uid,
    (r->>'week_id')::uuid,
    (r->>'date')::date,
    (r->>'start_time')::time,
    (r->>'end_time')::time,
    r->>'title',
    nullif(r->>'category_id', '')::uuid,
    r->>'kind',
    r->>'origin',
    nullif(r->>'template_activity_id', '')::uuid,
    nullif(r->>'split_group_id', '')::uuid,
    coalesce((r->>'notify')::boolean, true),
    coalesce((r->>'edited')::boolean, false),
    coalesce((r->>'done')::boolean, false),
    nullif(r->>'done_at', '')::timestamptz,
    r->>'note',
    nullif(r->>'external_id', '')
  from jsonb_array_elements(coalesce(p_insert, '[]'::jsonb)) as r
  returning *;
end;
$$;

grant execute on function public.apply_day_changes(uuid[], jsonb, jsonb) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. Cerrojo de sincronización por usuario (solo servidor)
-- ─────────────────────────────────────────────────────────────
-- gcal_lock: true si lo coge; si otro lo tiene, deja apuntado que hay que repetir y devuelve false.
create or replace function public.gcal_lock(p_user uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.google_accounts
     set sync_lock_until = now() + interval '2 minutes', sync_again = false
   where user_id = p_user and (sync_lock_until is null or sync_lock_until < now());
  if found then return true; end if;
  update public.google_accounts set sync_again = true where user_id = p_user;
  return false;
end;
$$;

-- gcal_unlock: suelta el cerrojo; true si alguien pidió otra pasada mientras tanto.
create or replace function public.gcal_unlock(p_user uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  update public.google_accounts set sync_lock_until = null where user_id = p_user returning sync_again;
$$;

revoke all on function public.gcal_lock(uuid) from public, anon, authenticated;
revoke all on function public.gcal_unlock(uuid) from public, anon, authenticated;
grant execute on function public.gcal_lock(uuid) to service_role;
grant execute on function public.gcal_unlock(uuid) to service_role;

-- ─────────────────────────────────────────────────────────────
-- 7. Realtime: la app abierta se entera de los cambios que hace el servidor
-- ─────────────────────────────────────────────────────────────
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'day_activities'
     ) then
    alter publication supabase_realtime add table public.day_activities;
  end if;
end $$;
