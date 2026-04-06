
-- 1. Notify admins when a new RSVP is created
CREATE OR REPLACE FUNCTION public.notify_on_new_rsvp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _admin RECORD;
  _user_name TEXT;
  _event_title TEXT;
BEGIN
  SELECT name INTO _user_name FROM profiles WHERE id = NEW.user_id;
  SELECT title INTO _event_title FROM events WHERE id = NEW.event_id;

  FOR _admin IN
    SELECT ur.user_id FROM user_roles ur WHERE ur.role = 'admin'
  LOOP
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      _admin.user_id,
      'New RSVP',
      COALESCE(_user_name, 'Someone') || ' has RSVP''d to ' || COALESCE(_event_title, 'an event') || '.',
      'rsvp',
      jsonb_build_object('event_id', NEW.event_id, 'rsvp_id', NEW.id, 'user_name', _user_name)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_rsvp
  AFTER INSERT ON public.rsvps
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_new_rsvp();

-- 2. Notify RSVPed users when an event is cancelled
CREATE OR REPLACE FUNCTION public.notify_on_event_cancelled()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _rsvp RECORD;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    FOR _rsvp IN
      SELECT user_id FROM rsvps WHERE event_id = NEW.id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, metadata)
      VALUES (
        _rsvp.user_id,
        'Event Cancelled',
        NEW.title || ' has been cancelled.',
        'event',
        jsonb_build_object('event_id', NEW.id)
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_event_cancelled
  AFTER UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_event_cancelled();

-- 3. Notify requesting user when their guest request is approved/rejected
CREATE OR REPLACE FUNCTION public.notify_on_guest_request_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _event_title TEXT;
  _status_label TEXT;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT title INTO _event_title FROM events WHERE id = NEW.event_id;
    _status_label := CASE WHEN NEW.status = 'approved' THEN 'approved' ELSE 'declined' END;

    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.requesting_user_id,
      'Guest Request ' || initcap(NEW.status),
      'Your guest request for ' || NEW.guest_name || ' to ' || COALESCE(_event_title, 'an event') || ' has been ' || _status_label || '.',
      'guest',
      jsonb_build_object('event_id', NEW.event_id, 'guest_request_id', NEW.id, 'status', NEW.status)
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_guest_request_update
  AFTER UPDATE ON public.guest_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_guest_request_update();
