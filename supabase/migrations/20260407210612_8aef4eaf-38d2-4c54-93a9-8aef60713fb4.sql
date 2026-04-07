
ALTER TABLE public.dependents
ADD COLUMN type text NOT NULL DEFAULT 'child';

-- Add a check constraint for valid types
ALTER TABLE public.dependents
ADD CONSTRAINT dependents_type_check CHECK (type IN ('child', 'elder'));
