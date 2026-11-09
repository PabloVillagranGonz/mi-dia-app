-- Cuenta de demostración: cada noche a las 04:00 (hora del servidor, UTC) la Edge Function `admin`
-- le restablece los datos de ejemplo, el email y la contraseña (por si alguien los cambió).
-- Requisitos: 0008 ejecutado, la función `admin` desplegada y los secretos DEMO_EMAIL y DEMO_PASSWORD.
-- Usa el mismo secreto de Vault que los demás crons (push_cron_secret, ver 0004).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobid) from cron.job where jobname = 'mi-dia-demo-reset';

select cron.schedule(
  'mi-dia-demo-reset',
  '0 4 * * *',
  $$
  select net.http_post(
    url := 'https://bnqxmgtpqwhaztvpneyx.supabase.co/functions/v1/admin/demo-reset',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- Quitar: select cron.unschedule('mi-dia-demo-reset');
