-- Vereist: pg_cron en pg_net extensies
-- Vul hieronder je service role key in (Supabase dashboard → Settings → API → service_role)
-- Sla de key op als database setting zodat hij niet zichtbaar is in migration history:
--   ALTER DATABASE postgres SET app.service_role_key = 'jouw-service-role-key';

SELECT cron.schedule(
  'match-users-dagelijks',
  '0 22 * * *',
  $$
  SELECT extensions.http_post(
    url  := 'https://chbvdbxjyjohamyyopde.supabase.co/functions/v1/match-users',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'
  );
  $$
);

SELECT cron.schedule(
  'finalize-matches-dagelijks',
  '0 23 * * *',
  $$
  SELECT extensions.http_post(
    url  := 'https://chbvdbxjyjohamyyopde.supabase.co/functions/v1/finalize-matches',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
    ),
    body := '{}'
  );
  $$
);
