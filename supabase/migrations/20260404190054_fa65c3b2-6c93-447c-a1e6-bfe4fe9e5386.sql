
-- Add new columns to events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS cover_photo_url text,
  ADD COLUMN IF NOT EXISTS end_date_time timestamptz,
  ADD COLUMN IF NOT EXISTS is_hybrid boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS virtual_link text,
  ADD COLUMN IF NOT EXISTS waitlist_capacity integer NOT NULL DEFAULT 0;

-- Create event_sign_up_items table
CREATE TABLE public.event_sign_up_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  item_name text NOT NULL,
  quantity_limit integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_sign_up_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sign up items"
  ON public.event_sign_up_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Approved users can view sign up items"
  ON public.event_sign_up_items FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'approved'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for event cover photos
INSERT INTO storage.buckets (id, name, public) VALUES ('event-covers', 'event-covers', true);

CREATE POLICY "Anyone can view event covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-covers');

CREATE POLICY "Admins can upload event covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'event-covers' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update event covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'event-covers' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete event covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'event-covers' AND has_role(auth.uid(), 'admin'::app_role));
