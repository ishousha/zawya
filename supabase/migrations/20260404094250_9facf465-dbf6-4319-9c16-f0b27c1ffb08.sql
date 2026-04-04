
-- Potluck category enum
CREATE TYPE public.potluck_category AS ENUM ('main', 'side', 'dessert', 'drinks');

-- Potluck config table
CREATE TABLE public.potluck_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  category potluck_category NOT NULL,
  max_slots INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_id, category)
);

ALTER TABLE public.potluck_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can view potluck config"
  ON public.potluck_config FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('approved', 'admin')
    )
  );

CREATE POLICY "Admins can manage potluck config"
  ON public.potluck_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- RSVPs table
CREATE TABLE public.rsvps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  guests_count INTEGER NOT NULL DEFAULT 1 CHECK (guests_count >= 1 AND guests_count <= 10),
  potluck_category potluck_category,
  specific_food_item TEXT,
  checked_in BOOLEAN NOT NULL DEFAULT false,
  qr_hash TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.rsvps ENABLE ROW LEVEL SECURITY;

-- Approved users can view RSVPs for events
CREATE POLICY "Approved users can view rsvps"
  ON public.rsvps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('approved', 'admin')
    )
  );

-- Users can create their own RSVP
CREATE POLICY "Users can create own rsvp"
  ON public.rsvps FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own RSVP
CREATE POLICY "Users can update own rsvp"
  ON public.rsvps FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own RSVP
CREATE POLICY "Users can delete own rsvp"
  ON public.rsvps FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can manage all RSVPs (for check-in etc.)
CREATE POLICY "Admins can manage all rsvps"
  ON public.rsvps FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- Add trigger for rsvps updated_at
CREATE TRIGGER update_rsvps_updated_at
  BEFORE UPDATE ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Also add admin event management policies
CREATE POLICY "Admins can insert events"
  ON public.events FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can update events"
  ON public.events FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete events"
  ON public.events FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );
