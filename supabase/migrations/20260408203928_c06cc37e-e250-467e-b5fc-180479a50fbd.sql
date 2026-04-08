
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

CREATE OR REPLACE FUNCTION public.notify_family_on_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _member RECORD;
  _leaver_name TEXT;
  _family_name TEXT;
BEGIN
  IF OLD.family_id IS NOT NULL AND NEW.family_id IS NULL THEN
    _leaver_name := COALESCE(OLD.name, 'A member');
    SELECT name INTO _family_name FROM families WHERE id = OLD.family_id;
    FOR _member IN
      SELECT id FROM profiles
      WHERE family_id = OLD.family_id AND id != OLD.id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, metadata)
      VALUES (
        _member.id,
        'Family member left',
        _leaver_name || ' has left ' || COALESCE(_family_name, 'the family group') || '.',
        'family',
        jsonb_build_object('leaver_name', _leaver_name, 'family_id', OLD.family_id)
      );
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
