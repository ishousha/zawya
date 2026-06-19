ALTER TABLE public.dependents DROP CONSTRAINT IF EXISTS dependents_type_check;
ALTER TABLE public.dependents ADD CONSTRAINT dependents_type_check
CHECK (type = ANY (ARRAY['son','daughter','father','mother','maid','nanny','driver','househelper','other','child','elder','helper']));
ALTER TABLE public.dependents ADD COLUMN IF NOT EXISTS type_other text;