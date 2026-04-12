-- Ensure every dependent has at least a parent_id or family_id set
ALTER TABLE public.dependents
ADD CONSTRAINT dependents_must_have_owner
CHECK (parent_id IS NOT NULL OR family_id IS NOT NULL);