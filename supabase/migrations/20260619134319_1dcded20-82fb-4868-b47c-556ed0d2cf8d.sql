ALTER TABLE public.dependents DROP CONSTRAINT IF EXISTS dependents_type_check;
ALTER TABLE public.dependents ADD CONSTRAINT dependents_type_check
  CHECK (type = ANY (ARRAY['child'::text, 'elder'::text, 'helper'::text, 'driver'::text, 'other'::text]));