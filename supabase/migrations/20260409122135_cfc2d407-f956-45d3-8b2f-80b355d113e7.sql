
-- 1. Create enum type
CREATE TYPE public.rsvp_status AS ENUM ('attending', 'waitlisted', 'cancelled');

-- 2. Add status column
ALTER TABLE public.rsvps ADD COLUMN status public.rsvp_status NOT NULL DEFAULT 'attending';

-- 3. Migrate existing data
UPDATE public.rsvps SET status = CASE WHEN is_waitlisted THEN 'waitlisted'::rsvp_status ELSE 'attending'::rsvp_status END;

-- 4. Create the waitlist auto-promotion trigger function
CREATE OR REPLACE FUNCTION public.promote_waitlisted_on_cancel()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _next RECORD;
  _event_title TEXT;
  _cap INT;
  _attending_count INT;
  _prefs JSONB;
BEGIN
  -- Only act when status changes TO 'cancelled'
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    -- Get event capacity
    SELECT capacity, title INTO _cap, _event_title FROM events WHERE id = NEW.event_id;

    -- If no capacity limit, nothing to do
    IF _cap IS NULL THEN
      RETURN NEW;
    END IF;

    -- Count current attending
    SELECT COUNT(*) INTO _attending_count FROM rsvps
    WHERE event_id = NEW.event_id AND status = 'attending';

    -- If now under capacity, promote oldest waitlisted
    IF _attending_count < _cap THEN
      SELECT id, user_id INTO _next FROM rsvps
      WHERE event_id = NEW.event_id AND status = 'waitlisted'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF FOUND THEN
        UPDATE rsvps SET status = 'attending', is_waitlisted = false WHERE id = _next.id;

        -- Check notification preferences
        SELECT notification_preferences INTO _prefs FROM profiles WHERE id = _next.user_id;

        IF COALESCE((_prefs->>'rsvp')::boolean, true) THEN
          INSERT INTO notifications (user_id, title, message, type, metadata)
          VALUES (
            _next.user_id,
            'You''re In! 🎉',
            'Waitlist Alert: You are officially in for ' || COALESCE(_event_title, 'an event') || '!',
            'rsvp',
            jsonb_build_object('event_id', NEW.event_id, 'action', 'waitlist_promoted')
          );
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 5. Attach trigger
CREATE TRIGGER trg_promote_waitlisted
AFTER UPDATE ON public.rsvps
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlisted_on_cancel();
