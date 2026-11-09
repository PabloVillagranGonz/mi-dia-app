-- Llama cada minuto a la Edge Function `push`, que envía los avisos pendientes.
-- Requisitos: 0003_web_push.sql ejecutado, la función `push` desplegada y su secreto CRON_SECRET puesto.
--
-- ANTES de ejecutar este archivo, guarda el mismo secreto en Vault (una sola vez, en otra consulta):
--   select vault.create_secret('<el mismo valor que CRON_SECRET>', 'push_cron_secret');
-- (No lo escribas aquí: este archivo está en git.)

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Si ya existía, se sustituye
select cron.unschedule(jobid) from cron.job where jobname = 'mi-dia-push';

select cron.schedule(
  'mi-dia-push',
  '* * * * *',
  $$
  select net.http_post(
    url := 'https://bnqxmgtpqwhaztvpneyx.supabase.co/functions/v1/push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $$
);

-- Comprobar: select * from cron.job_run_details order by start_time desc limit 5;
--            select * from net._http_response order by created desc limit 5;
