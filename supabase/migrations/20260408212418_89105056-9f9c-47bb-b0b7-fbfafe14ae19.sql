
-- Add notification_preferences jsonb column with all types enabled by default
ALTER TABLE public.profiles
ADD COLUMN notification_preferences jsonb NOT NULL DEFAULT '{"events": true, "rsvp": true, "guest": true, "family": true, "info": true}'::jsonb;

-- Update: notify_on_account_approved — respects 'info' preference
CREATE OR REPLACE FUNCTION public.notify_on_account_approved()
RETURNS trigger AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role AND NEW.role = 'approved' THEN
    IF COALESCE((NEW.notification_preferences->>'info')::boolean, true) THEN
      INSERT INTO notifications (user_id, title, message, type, metadata)
      VALUES (NEW.id, 'Welcome!', 'Your account has been approved. Welcome to the community!', 'info', '{"action": "account_approved"}'::jsonb);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Update: notify_on_event_cancelled — respects 'events' preference
CREATE OR REPLACE FUNCTION public.notify_on_event_cancelled()
RETURNS trigger AS $$
DECLARE
  _rsvp RECORD;
  _prefs jsonb;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    FOR _rsvp IN
      SELECT r.user_id FROM rsvps r WHERE r.event_id = NEW.id
    LOOP
      SELECT notification_preferences INTO _prefs FROM profiles WHERE id = _rsvp.user_id;
      IF COALESCE((_prefs->>'events')::boolean, true) THEN
        INSERT INTO notifications (user_id, title, message, type, metadata)
        VALUES (
          _rsvp.user_id,
          'Event Cancelled',
          NEW.title || ' has been cancelled.',
          'event',
          jsonb_build_object('event_id', NEW.id)
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Update: notify_on_guest_request_update — respects 'guest' preference
CREATE OR REPLACE FUNCTION public.notify_on_guest_request_update()
RETURNS trigger AS $$
DECLARE
  _event_title TEXT;
  _status_label TEXT;
  _prefs jsonb;
BEGIN
  IF OLD.status = 'pending' AND NEW.status IN ('approved', 'rejected') THEN
    SELECT notification_preferences INTO _prefs FROM profiles WHERE id = NEW.requesting_user_id;
    IF COALESCE((_prefs->>'guest')::boolean, true) THEN
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
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Update: notify_family_on_leave — respects 'family' preference
CREATE OR REPLACE FUNCTION public.notify_family_on_leave()
RETURNS trigger AS $$
DECLARE
  _member RECORD;
  _leaver_name TEXT;
  _family_name TEXT;
BEGIN
  IF OLD.family_id IS NOT NULL AND NEW.family_id IS NULL THEN
    _leaver_name := COALESCE(OLD.name, 'A member');
    SELECT name INTO _family_name FROM families WHERE id = OLD.family_id;
    FOR _member IN
      SELECT id, notification_preferences FROM profiles
      WHERE family_id = OLD.family_id AND id != OLD.id
    LOOP
      IF COALESCE((_member.notification_preferences->>'family')::boolean, true) THEN
        INSERT INTO notifications (user_id, title, message, type, metadata)
        VALUES (
          _member.id,
          'Family member left',
          _leaver_name || ' has left ' || COALESCE(_family_name, 'the family group') || '.',
          'family',
          jsonb_build_object('leaver_name', _leaver_name, 'family_id', OLD.family_id)
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';
