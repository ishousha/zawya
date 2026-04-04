
-- Add order_index for reordering items
ALTER TABLE public.event_sign_up_items
  ADD COLUMN IF NOT EXISTS order_index integer NOT NULL DEFAULT 0;

-- Create rsvp_sign_up_selections table
CREATE TABLE public.rsvp_sign_up_selections (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  rsvp_id uuid NOT NULL REFERENCES public.rsvps(id) ON DELETE CASCADE,
  sign_up_item_id bigint NOT NULL REFERENCES public.event_sign_up_items(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(rsvp_id, sign_up_item_id)
);

ALTER TABLE public.rsvp_sign_up_selections ENABLE ROW LEVEL SECURITY;

-- Admins can manage all selections
CREATE POLICY "Admins can manage all selections"
  ON public.rsvp_sign_up_selections FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own selections (via rsvp ownership)
CREATE POLICY "Users can view own selections"
  ON public.rsvp_sign_up_selections FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rsvps
      WHERE rsvps.id = rsvp_sign_up_selections.rsvp_id
        AND rsvps.user_id = auth.uid()
    )
  );

-- Users can create selections on their own RSVPs
CREATE POLICY "Users can create own selections"
  ON public.rsvp_sign_up_selections FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.rsvps
      WHERE rsvps.id = rsvp_sign_up_selections.rsvp_id
        AND rsvps.user_id = auth.uid()
    )
  );

-- Users can update their own selections
CREATE POLICY "Users can update own selections"
  ON public.rsvp_sign_up_selections FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rsvps
      WHERE rsvps.id = rsvp_sign_up_selections.rsvp_id
        AND rsvps.user_id = auth.uid()
    )
  );

-- Users can delete their own selections
CREATE POLICY "Users can delete own selections"
  ON public.rsvp_sign_up_selections FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.rsvps
      WHERE rsvps.id = rsvp_sign_up_selections.rsvp_id
        AND rsvps.user_id = auth.uid()
    )
  );
