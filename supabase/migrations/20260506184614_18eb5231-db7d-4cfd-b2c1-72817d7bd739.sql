CREATE OR REPLACE FUNCTION public.notify_on_guest_request_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
        'Guest Request ' || initcap(NEW.status::text),
        'Your guest request for ' || NEW.guest_name || ' to ' || COALESCE(_event_title, 'an event') || ' has been ' || _status_label || '.',
        'guest',
        jsonb_build_object('event_id', NEW.event_id, 'guest_request_id', NEW.id, 'status', NEW.status)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;