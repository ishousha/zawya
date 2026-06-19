
CREATE TABLE public.external_guests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  notes text,
  times_invited integer NOT NULL DEFAULT 0,
  times_approved integer NOT NULL DEFAULT 0,
  times_attended integer NOT NULL DEFAULT 0,
  last_invited_at timestamptz,
  last_attended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.external_guests TO authenticated;
GRANT ALL ON public.external_guests TO service_role;

ALTER TABLE public.external_guests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their saved guests"
  ON public.external_guests FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Admins and moderators can view all saved guests"
  ON public.external_guests FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'moderator'::app_role)
  );

CREATE UNIQUE INDEX external_guests_owner_name_phone_uniq
  ON public.external_guests (owner_id, lower(name), COALESCE(phone, ''));

CREATE INDEX external_guests_owner_idx ON public.external_guests (owner_id);

CREATE TRIGGER external_guests_updated_at
  BEFORE UPDATE ON public.external_guests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.guest_requests
  ADD COLUMN external_guest_id uuid REFERENCES public.external_guests(id) ON DELETE SET NULL;

CREATE INDEX guest_requests_external_guest_idx
  ON public.guest_requests (external_guest_id);

CREATE OR REPLACE FUNCTION public.bump_external_guest_stats()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.external_guest_id IS NOT NULL THEN
    UPDATE public.external_guests
      SET times_invited = times_invited + 1,
          last_invited_at = now()
      WHERE id = NEW.external_guest_id;
  ELSIF TG_OP = 'UPDATE'
        AND NEW.external_guest_id IS NOT NULL
        AND OLD.status IS DISTINCT FROM NEW.status
        AND NEW.status::text = 'approved' THEN
    UPDATE public.external_guests
      SET times_approved = times_approved + 1
      WHERE id = NEW.external_guest_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guest_requests_bump_external_guest_stats
  AFTER INSERT OR UPDATE ON public.guest_requests
  FOR EACH ROW EXECUTE FUNCTION public.bump_external_guest_stats();
