
-- History table for automated deliverability checks
CREATE TABLE IF NOT EXISTS public.deliverability_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sender JSONB NOT NULL,
  root JSONB NOT NULL,
  alignment JSONB NOT NULL,
  dmarc_org_present BOOLEAN NOT NULL DEFAULT false,
  source TEXT NOT NULL DEFAULT 'cron'
);

CREATE INDEX IF NOT EXISTS idx_deliverability_checks_checked_at
  ON public.deliverability_checks (checked_at DESC);

ALTER TABLE public.deliverability_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view deliverability history"
  ON public.deliverability_checks
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Required extensions for scheduled HTTP calls
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule any prior version
DO $$
BEGIN
  PERFORM cron.unschedule('deliverability-daily-check');
EXCEPTION WHEN OTHERS THEN NULL;
END$$;

SELECT cron.schedule(
  'deliverability-daily-check',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1) || '/functions/v1/check-deliverability',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1)
    ),
    body := jsonb_build_object('persist', true, 'source', 'cron')
  ) AS request_id;
  $$
);
