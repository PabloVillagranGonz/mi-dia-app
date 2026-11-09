-- Mi Día — 0002: aplicar cambios de un día en UNA transacción.
-- Pegar entero en Supabase → SQL Editor → Run.
--
-- La app calcula los cambios (recortes de un evento, restaurar rutina, aplicar la rutina base…)
-- y los manda juntos. Si algo falla, no se aplica nada: el día nunca queda a medias.
--
-- p_delete: array de ids a borrar
-- p_update: array de objetos {id, start_time, end_time}
-- p_insert: array de filas de day_activities (sin id ni user_id)

create or replace function public.apply_day_changes(
  p_delete uuid[] default '{}',
  p_update jsonb default '[]',
  p_insert jsonb default '[]'
)
returns setof public.day_activities
language plpgsql
security invoker            -- se ejecuta como el usuario: el RLS sigue aplicando
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
    template_activity_id, split_group_id, notify, edited, done, done_at, note
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
    r->>'note'
  from jsonb_array_elements(coalesce(p_insert, '[]'::jsonb)) as r
  returning *;
end;
$$;

grant execute on function public.apply_day_changes(uuid[], jsonb, jsonb) to authenticated;
