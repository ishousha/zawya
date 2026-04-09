
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
  _profile RECORD;
  _supabase_url TEXT;
  _service_key TEXT;
  _payload JSONB;
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    SELECT capacity, title INTO _cap, _event_title FROM events WHERE id = NEW.event_id;

    IF _cap IS NULL THEN
      RETURN NEW;
    END IF;

    SELECT COUNT(*) INTO _attending_count FROM rsvps
    WHERE event_id = NEW.event_id AND status = 'attending';

    IF _attending_count < _cap THEN
      SELECT id, user_id INTO _next FROM rsvps
      WHERE event_id = NEW.event_id AND status = 'waitlisted'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED;

      IF FOUND THEN
        UPDATE rsvps SET status = 'attending', is_waitlisted = false WHERE id = _next.id;

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

        -- Send promotion email via edge function
        SELECT email, name INTO _profile FROM profiles WHERE id = _next.user_id;

        IF _profile.email IS NOT NULL THEN
          SELECT decrypted_secret INTO _supabase_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
          SELECT decrypted_secret INTO _service_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

          IF _supabase_url IS NOT NULL AND _service_key IS NOT NULL THEN
            _payload := jsonb_build_object(
              'templateName', 'event-reactivated',
              'recipientEmail', _profile.email,
              'idempotencyKey', 'waitlist-promote-' || _next.id || '-' || extract(epoch from now())::text,
              'templateData', jsonb_build_object(
                'memberName', COALESCE(_profile.name, ''),
                'eventTitle', COALESCE(_event_title, 'an event'),
                'message', 'Great news! A spot has opened up and you''ve been moved from the waitlist to confirmed. Your RSVP is now active!'
              )
            );

            PERFORM net.http_post(
              url := _supabase_url || '/functions/v1/send-transactional-email',
              headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || _service_key
              ),
              body := _payload
            );
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
