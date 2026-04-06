
-- Create invite status enum
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'expired');

-- Create family_invites table
CREATE TABLE public.family_invites (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  family_id uuid NOT NULL REFERENCES public.families(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  status invite_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.family_invites ENABLE ROW LEVEL SECURITY;

-- Users can create invites for their own family
CREATE POLICY "Users can create invites for own family"
  ON public.family_invites FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND family_id IN (
      SELECT p.family_id FROM public.profiles p WHERE p.id = auth.uid() AND p.family_id IS NOT NULL
    )
  );

-- Users can view invites for their own family
CREATE POLICY "Users can view own family invites"
  ON public.family_invites FOR SELECT TO authenticated
  USING (
    family_id IN (
      SELECT p.family_id FROM public.profiles p WHERE p.id = auth.uid() AND p.family_id IS NOT NULL
    )
  );

-- Admins can do everything
CREATE POLICY "Admins can manage all invites"
  ON public.family_invites FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to accept an invite by token
CREATE OR REPLACE FUNCTION public.accept_family_invite(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invite RECORD;
  _family_name text;
BEGIN
  -- Find the invite
  SELECT * INTO _invite FROM public.family_invites
    WHERE token = _token AND status = 'pending'
    FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invite not found or already used');
  END IF;

  -- Check the user is not already in a family
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND family_id IS NOT NULL) THEN
    RETURN jsonb_build_object('success', false, 'error', 'You are already in a family');
  END IF;

  -- Assign user to the family
  UPDATE public.profiles SET family_id = _invite.family_id WHERE id = auth.uid();

  -- Mark invite as accepted
  UPDATE public.family_invites SET status = 'accepted' WHERE id = _invite.id;

  -- Get family name
  SELECT name INTO _family_name FROM public.families WHERE id = _invite.family_id;

  RETURN jsonb_build_object('success', true, 'family_name', _family_name);
END;
$$;
