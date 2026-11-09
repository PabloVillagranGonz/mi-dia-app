-- Mi Día — 0008: panel de administración y cuenta de demostración.
--
-- user_flags: qué es cada usuario. La app lee SU fila (para mostrar Administración, ocultar
-- Google en la demo…); solo el servidor (Edge Function `admin`, clave de servicio) la escribe.
-- Sin fila = usuario normal.

create table if not exists public.user_flags (
  user_id uuid primary key references auth.users on delete cascade,
  is_admin boolean not null default false,
  is_demo boolean not null default false,
  gcal_allowed boolean not null default false,   -- puede conectar Google Calendar
  updated_at timestamptz not null default now()
);

alter table public.user_flags enable row level security;
drop policy if exists "own flags read" on public.user_flags;
create policy "own flags read" on public.user_flags for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.user_flags from anon, authenticated;
grant select on public.user_flags to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Restablecer los datos de un usuario a los de ejemplo (para la demo).
-- Borra todo lo suyo y vuelve a ejecutar el alta (categorías, ajustes y rutina de ejemplo).
-- No toca auth.users: el email y la contraseña los restablece la Edge Function.
-- ─────────────────────────────────────────────────────────────
create or replace function public.reset_user_data(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.user_flags where user_id = p_user and is_demo) then
    raise exception 'Solo se pueden restablecer cuentas de demostración';
  end if;

  delete from public.push_subscriptions where user_id = p_user;
  delete from public.push_log where user_id = p_user;
  delete from public.google_events where user_id = p_user;
  delete from public.google_calendars where user_id = p_user;
  delete from public.google_accounts where user_id = p_user;
  delete from public.weeks where user_id = p_user;               -- y en cascada day_activities
  delete from public.template_activities where user_id = p_user;
  delete from public.categories where user_id = p_user;
  delete from public.settings where user_id = p_user;

  perform public.seed_user(p_user);
end;
$$;

revoke all on function public.reset_user_data(uuid) from public, anon, authenticated;
grant execute on function public.reset_user_data(uuid) to service_role;
