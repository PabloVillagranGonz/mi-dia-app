-- Google Calendar: ocultar en Ajustes los calendarios que no se usan (solo afecta a la lista).
alter table public.google_calendars add column if not exists hidden boolean not null default false;
grant select (hidden), update (hidden) on public.google_calendars to authenticated;
