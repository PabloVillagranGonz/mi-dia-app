-- Mi Día — esquema inicial (Fase 1)
-- Pegar entero en Supabase → SQL Editor → Run. Es idempotente solo en parte:
-- si falla a mitad, borra las tablas creadas antes de volver a lanzarlo.

-- ─────────────────────────────────────────────────────────────
-- Tablas
-- ─────────────────────────────────────────────────────────────

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  color text not null,                 -- hex, p. ej. #4F8CFF
  sort_order int not null default 0,
  created_at timestamptz default now()
);
create index on public.categories (user_id, sort_order);

-- Rutina base: una fila por actividad y día de la semana
create table public.template_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),   -- 1 = lunes … 7 = domingo
  start_time time not null,
  end_time time not null,               -- admite 24:00
  title text not null,
  category_id uuid references public.categories on delete set null,
  kind text not null check (kind in ('task','fixed')),
  notify boolean not null default true,
  split_group_id uuid,                  -- enlaza las dos mitades que cruzan medianoche
  created_at timestamptz default now(),
  check (end_time > start_time)
);
create index on public.template_activities (user_id, weekday);

-- Semanas generadas
create table public.weeks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),  -- siempre lunes
  source text not null check (source in ('base','copy','auto')),
  planned_at timestamptz default now(),
  unique (user_id, week_start)
);

-- Actividades concretas de cada día
create table public.day_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  week_id uuid not null references public.weeks on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  title text not null,
  category_id uuid references public.categories on delete set null,
  kind text not null check (kind in ('task','fixed')),
  origin text not null check (origin in ('template','event','manual')),
  template_activity_id uuid references public.template_activities on delete set null,
  split_group_id uuid,
  notify boolean not null default true,
  edited boolean not null default false,   -- ajustada a mano ese día: «aplicar rutina» no la sobrescribe
  done boolean not null default false,
  done_at timestamptz,
  note text,
  created_at timestamptz default now(),
  check (end_time > start_time)
);
create index on public.day_activities (user_id, date);
create index on public.day_activities (week_id);

-- Ajustes
create table public.settings (
  user_id uuid primary key references auth.users on delete cascade,
  planning_reminder_weekday smallint not null default 7 check (planning_reminder_weekday between 1 and 7),
  planning_reminder_time time not null default '20:00',
  notifications_enabled boolean not null default true,
  timezone text not null default 'Europe/Madrid'
);

-- ─────────────────────────────────────────────────────────────
-- RLS: cada usuario solo ve y toca lo suyo
-- ─────────────────────────────────────────────────────────────

alter table public.categories          enable row level security;
alter table public.template_activities enable row level security;
alter table public.weeks               enable row level security;
alter table public.day_activities      enable row level security;
alter table public.settings            enable row level security;

create policy "propias" on public.categories
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propias" on public.template_activities
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propias" on public.weeks
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propias" on public.day_activities
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "propios" on public.settings
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Alta inicial: categorías, ajustes y rutina base (spec §6)
-- ─────────────────────────────────────────────────────────────

create or replace function public.seed_user(uid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_trabajo  uuid;
  c_musica   uuid;
  c_salud    uuid;
  c_personal uuid;
  d smallint;
begin
  -- No duplicar si ya tiene datos
  if exists (select 1 from public.categories where user_id = uid) then
    return;
  end if;

  insert into public.categories (user_id, name, color, sort_order) values (uid, 'Trabajo / estudio', '#4F8CFF', 0) returning id into c_trabajo;
  insert into public.categories (user_id, name, color, sort_order) values (uid, 'Música',            '#B07CFF', 1) returning id into c_musica;
  insert into public.categories (user_id, name, color, sort_order) values (uid, 'Salud',             '#34D399', 2) returning id into c_salud;
  insert into public.categories (user_id, name, color, sort_order) values (uid, 'Personal',          '#F5B544', 3) returning id into c_personal;

  insert into public.settings (user_id) values (uid) on conflict do nothing;

  -- Común de lunes a viernes
  for d in 1..5 loop
    insert into public.template_activities (user_id, weekday, start_time, end_time, title, category_id, kind, notify) values
      (uid, d, '00:30', '09:00', 'Dormir',                c_salud,    'fixed', false),
      (uid, d, '09:00', '09:30', 'Despertar y desayuno',  c_salud,    'fixed', true),
      (uid, d, '09:30', '10:30', 'Deporte',               c_salud,    'task',  true),
      (uid, d, '10:30', '12:30', 'Programar / proyectos', c_trabajo,  'task',  true),
      (uid, d, '12:30', '13:30', 'Practicar instrumento', c_musica,   'task',  true),
      (uid, d, '13:30', '14:00', 'Casa y recados',        c_personal, 'task',  true),
      (uid, d, '14:00', '16:00', 'Comida y descanso',     c_salud,    'fixed', true),
      (uid, d, '21:30', '22:30', 'Cena',                  c_salud,    'fixed', true);
  end loop;

  -- Tardes por día
  insert into public.template_activities (user_id, weekday, start_time, end_time, title, category_id, kind, notify) values
    (uid, 1, '16:00', '18:00', 'Practicar instrumento', c_musica,   'task', true),
    (uid, 1, '18:00', '20:00', 'Programar / proyectos', c_trabajo,  'task', true),
    (uid, 2, '16:00', '20:00', 'Conservatorio',         c_musica,   'task', true),
    (uid, 3, '16:00', '17:30', 'Practicar instrumento', c_musica,   'task', true),
    (uid, 3, '17:30', '19:00', 'Programar / proyectos', c_trabajo,  'task', true),
    (uid, 3, '19:30', '21:00', 'Conservatorio',         c_musica,   'task', true),
    (uid, 4, '16:00', '18:00', 'Practicar instrumento', c_musica,   'task', true),
    (uid, 4, '18:00', '20:00', 'Deporte / ocio',        c_personal, 'task', true),
    (uid, 5, '16:00', '20:00', 'Conservatorio',         c_musica,   'task', true);
  -- Sábado y domingo: vacíos.
end;
$$;

-- Solo la puede ejecutar el sistema (trigger) o tú desde el SQL Editor
revoke execute on function public.seed_user(uuid) from public, anon, authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_user(new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
