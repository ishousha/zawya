-- 1. Create event_types table
CREATE TABLE public.event_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  icon text NOT NULL DEFAULT 'MapPin',
  requires_location boolean NOT NULL DEFAULT true,
  allows_potluck boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.event_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view event types"
  ON public.event_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage event types"
  ON public.event_types FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Moderators can manage event types"
  ON public.event_types FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'moderator'::app_role));

-- 2. Seed default types matching existing enum + UI config
INSERT INTO public.event_types (name, icon, requires_location, allows_potluck) VALUES
  ('Gathering / Potluck', 'MapPin', true, true),
  ('Class / Halaqa', 'BookOpen', true, true),
  ('Trip / Picnic', 'Users', true, true),
  ('Retreat / Rihla', 'Mountain', true, true),
  ('Community Meeting', 'Handshake', true, true),
  ('Nasiha', 'Video', false, false);

-- 3. Add event_type_id to events
ALTER TABLE public.events
  ADD COLUMN event_type_id uuid REFERENCES public.event_types(id);

-- 4. Migrate existing events
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE name = 'Gathering / Potluck') WHERE type IN ('gathering', 'physical');
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE name = 'Class / Halaqa') WHERE type = 'class';
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE name = 'Trip / Picnic') WHERE type IN ('trip', 'kids');
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE name = 'Retreat / Rihla') WHERE type = 'retreat';
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE name = 'Community Meeting') WHERE type = 'meeting';
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE name = 'Nasiha') WHERE type = 'nasiha';
UPDATE public.events SET event_type_id = (SELECT id FROM public.event_types WHERE name = 'Gathering / Potluck') WHERE event_type_id IS NULL;

-- 5. Make it non-nullable now that all rows are migrated
ALTER TABLE public.events ALTER COLUMN event_type_id SET NOT NULL;

-- 6. Drop old type column and enum
ALTER TABLE public.events DROP COLUMN type;
DROP TYPE IF EXISTS public.event_type;