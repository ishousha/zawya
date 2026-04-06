
-- Add display_order column
ALTER TABLE public.event_types
ADD COLUMN display_order integer NOT NULL DEFAULT 0;

-- Set initial order based on alphabetical name
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY name) AS rn
  FROM public.event_types
)
UPDATE public.event_types
SET display_order = ordered.rn
FROM ordered
WHERE public.event_types.id = ordered.id;
