CREATE OR REPLACE FUNCTION public.promote_waitlisted_on_capacity_increase()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _attending_count INT;
  _slots_available INT;
  _next RECORD;
  _prefs JSONB;
  _profile RECORD;
  _supabase_url TEXT;
  _service_key TEXT;
  _payload JSONB;
BEGIN
  -- Only act when capacity actually increases (and is set)
  IF NEW.capacity IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.capacity IS NOT DISTINCT FROM OLD.capacity THEN
    RETURN NEW;
  END IF;
  IF OLD.capacity IS NOT NULL AND NEW.capacity <= OLD.capacity THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO _attending_count FROM rsvps
  WHERE event_id = NEW.id AND status = 'attending';

  _slots_available := NEW.capacity - _attending_count;
  IF _slots_available <= 0 THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
  SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

  FOR _next IN
    SELECT id, user_id FROM rsvps
    WHERE event_id = NEW.id AND status = 'waitlisted'
    ORDER BY created_at ASC
    LIMIT _slots_available
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE rsvps SET status = 'attending', is_waitlisted = false WHERE id = _next.id;

    SELECT notification_preferences INTO _prefs FROM profiles WHERE id = _next.user_id;
    IF COALESCE((_prefs->>'rsvp')::boolean, true) THEN
      INSERT INTO notifications (user_id, title, message, type, metadata)
      VALUES (
        _next.user_id,
        'You''re In! 🎉',
        'Capacity expanded: You are officially in for ' || COALESCE(NEW.title, 'an event') || '!',
        'rsvp',
        jsonb_build_object('event_id', NEW.id, 'action', 'waitlist_promoted')
      );
    END IF;

    SELECT email, name INTO _profile FROM profiles WHERE id = _next.user_id;
    IF _profile.email IS NOT NULL AND _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
      _payload := jsonb_build_object(
        'templateName', 'event-reactivated',
        'recipientEmail', _profile.email,
        'idempotencyKey', 'capacity-promote-' || _next.id || '-' || extract(epoch from now())::text,
        'templateData', jsonb_build_object(
          'memberName', COALESCE(_profile.name, ''),
          'eventTitle', COALESCE(NEW.title, 'an event'),
          'message', 'Great news! Capacity has been increased and you''ve been moved from the waitlist to confirmed. Your RSVP is now active!'
        )
      );

      BEGIN
        PERFORM net.http_post(
          url := _supabase_url || '/functions/v1/send-transactional-email',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || _service_key
          ),
          body := _payload
        );
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_promote_waitlisted_on_capacity_increase ON public.events;
CREATE TRIGGER trg_promote_waitlisted_on_capacity_increase
AFTER UPDATE OF capacity ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.promote_waitlisted_on_capacity_increase();