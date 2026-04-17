
-- 1. Add audience_gender column with default 'Everyone'
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS audience_gender text NOT NULL DEFAULT 'Everyone';

ALTER TABLE public.events
  ADD CONSTRAINT events_audience_gender_check
  CHECK (audience_gender IN ('Everyone', 'Brothers Only', 'Sisters Only'));

-- 2. Add new array column age_groups (text[]) preserving existing single value
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS age_groups text[] NOT NULL DEFAULT ARRAY['All Ages']::text[];

-- Backfill from existing age_group column
UPDATE public.events
  SET age_groups = ARRAY[age_group]::text[]
  WHERE age_group IS NOT NULL
    AND (age_groups IS NULL OR age_groups = ARRAY['All Ages']::text[]);
