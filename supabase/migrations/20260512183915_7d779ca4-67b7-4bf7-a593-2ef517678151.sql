
ALTER TABLE public.deliverability_checks
  ADD COLUMN IF NOT EXISTS dmarc_policy TEXT;
