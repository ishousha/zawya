-- Add gender to profiles
ALTER TABLE public.profiles ADD COLUMN gender text;

-- Add gender and age_group to dependents
ALTER TABLE public.dependents ADD COLUMN gender text;
ALTER TABLE public.dependents ADD COLUMN age_group text;