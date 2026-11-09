-- Mi Día — 0010: estado del sistema para la consola de administración (sección «Sistema»).
-- Solo la llama la Edge Function `admin` (clave de servicio).

create or replace function public.admin_system_status()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  day_start timestamptz := (date_trunc('day', now() at time zone 'Europe/Madrid')) at time zone 'Europe/Madrid';
  jobs jsonb;
  http jsonb;
begin
  -- Crons: última ejecución y fallos de las últimas 24 h
  select coalesce(jsonb_agg(j order by j->>'jobname'), '[]'::jsonb) into jobs
  from (
    select jsonb_build_object(
      'jobname', job.jobname,
      'schedule', job.schedule,
      'active', job.active,
      'last_start', last.start_time,
      'last_status', last.status,
      'last_message', left(last.return_message, 200),
      'failures_24h', (
        select count(*) from cron.job_run_details d
         where d.jobid = job.jobid and d.status <> 'succeeded' and d.start_time > now() - interval '24 hours'
      ),
      'runs_24h', (
        select count(*) from cron.job_run_details d
         where d.jobid = job.jobid and d.start_time > now() - interval '24 hours'
      )
    ) as j
    from cron.job job
    left join lateral (
      select d.start_time, d.status, d.return_message from cron.job_run_details d
       where d.jobid = job.jobid order by d.start_time desc limit 1
    ) last on true
    where job.jobname like 'mi-dia-%'
  ) s;

  -- Llamadas HTTP de los crons a las Edge Functions (pg_net guarda unas horas)
  select jsonb_build_object(
    'total', count(*),
    'errors', count(*) filter (where status_code is null or status_code >= 400),
    'last_error', (
      select jsonb_build_object('at', r.created, 'status', r.status_code, 'message', left(coalesce(r.error_msg, r.content::text), 200))
        from net._http_response r
       where r.status_code is null or r.status_code >= 400
       order by r.created desc limit 1
    )
  ) into http
  from net._http_response;

  return jsonb_build_object(
    'jobs', jobs,
    'http', http,
    'push_sent_today', (select count(*) from public.push_log where sent_at >= day_start),
    'push_devices', (select count(*) from public.push_subscriptions),
    'checked_at', now()
  );
end;
$$;

revoke all on function public.admin_system_status() from public, anon, authenticated;
grant execute on function public.admin_system_status() to service_role;
