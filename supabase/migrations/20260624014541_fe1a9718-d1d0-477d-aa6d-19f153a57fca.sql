
ALTER TABLE public.rsvps
  ADD COLUMN IF NOT EXISTS removed_by_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS removed_by_admin_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by_admin_actor uuid REFERENCES auth.users(id);

CREATE INDEX IF NOT EXISTS idx_rsvps_removed_by_admin
  ON public.rsvps(event_id, user_id) WHERE removed_by_admin = true;

CREATE OR REPLACE FUNCTION public.enforce_admin_removal_block()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _is_admin boolean := false;
  _prior_removed boolean;
BEGIN
  -- service_role bypass
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    _is_admin := public.has_role(auth.uid(), 'admin'::app_role)
              OR public.has_role(auth.uid(), 'moderator'::app_role);
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- If a prior RSVP row for this (event,user) was admin-removed, block re-insert for non-admins
    IF NOT _is_admin THEN
      SELECT EXISTS (
        SELECT 1 FROM public.rsvps
        WHERE event_id = NEW.event_id
          AND user_id  = NEW.user_id
          AND removed_by_admin = true
          AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      ) INTO _prior_removed;

      IF COALESCE(_prior_removed, false) THEN
        RAISE EXCEPTION 'RSVP_ADMIN_REMOVED: An organizer has removed you from this event. Please contact them if this was a mistake.'
          USING ERRCODE = 'check_violation';
      END IF;

      -- Block setting the flag yourself
      IF COALESCE(NEW.removed_by_admin, false) = true THEN
        NEW.removed_by_admin := false;
        NEW.removed_by_admin_at := NULL;
        NEW.removed_by_admin_actor := NULL;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NOT _is_admin THEN
    -- Cannot clear the flag
    IF OLD.removed_by_admin = true AND COALESCE(NEW.removed_by_admin, false) = false THEN
      RAISE EXCEPTION 'RSVP_ADMIN_REMOVED: You cannot undo an organizer removal.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Cannot reactivate an admin-removed RSVP
    IF OLD.removed_by_admin = true AND NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status <> 'cancelled'::rsvp_status THEN
      RAISE EXCEPTION 'RSVP_ADMIN_REMOVED: An organizer has removed you from this event.'
        USING ERRCODE = 'check_violation';
    END IF;
    -- Cannot set the flag yourself
    IF COALESCE(OLD.removed_by_admin, false) = false
       AND COALESCE(NEW.removed_by_admin, false) = true THEN
      NEW.removed_by_admin := false;
      NEW.removed_by_admin_at := NULL;
      NEW.removed_by_admin_actor := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_admin_removal_block ON public.rsvps;
CREATE TRIGGER trg_enforce_admin_removal_block
  BEFORE INSERT OR UPDATE ON public.rsvps
  FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_removal_block();
