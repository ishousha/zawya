
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

-- Backfill: any user who already has a family_id has completed onboarding
UPDATE public.profiles SET onboarding_completed = true WHERE family_id IS NOT NULL;
