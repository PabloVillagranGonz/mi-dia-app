-- Google Calendar: sincronización de respaldo cada 15 minutos (issue #1).
-- Además de traer lo que se haya perdido, renueva los canales de aviso que caducan en < 48 h
-- y hace el sync completo al empezar semana.
-- Requisitos: 0005 ejecutado, la función `gcal-sync` desplegada y su CRON_SECRET puesto.
-- Usa el mismo secreto de Vault que el cron de avisos (push_cron_secret, ver 0004).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'mi-dia-gcal-sync';

select cron.schedule(
  'mi-dia-gcal-sync',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://bnqxmgtpqwhaztvpneyx.supabase.co/functions/v1/gcal-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);

-- Comprobar: select * from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'mi-dia-gcal-sync') order by start_time desc limit 5;
-- Quitar:    select cron.unschedule('mi-dia-gcal-sync');
