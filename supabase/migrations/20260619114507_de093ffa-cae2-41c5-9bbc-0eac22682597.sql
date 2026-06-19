CREATE OR REPLACE FUNCTION public.notify_admins_on_guest_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin RECORD;
  _event_title TEXT;
  _requester_name TEXT;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT title INTO _event_title FROM public.events WHERE id = NEW.event_id;
  SELECT COALESCE(NULLIF(btrim(name), ''), email, 'A member') INTO _requester_name
    FROM public.profiles WHERE id = NEW.requesting_user_id;

  FOR _admin IN
    SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      _admin.user_id,
      'New guest request',
      COALESCE(_requester_name, 'A member') || ' requested ' || NEW.guest_name || ' for ' || COALESCE(_event_title, 'an event') || '.',
      'guest_request',
      jsonb_build_object('event_id', NEW.event_id, 'guest_request_id', NEW.id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_on_guest_request ON public.guest_requests;
CREATE TRIGGER trg_notify_admins_on_guest_request
AFTER INSERT ON public.guest_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_guest_request();

-- Allow requesting members to delete their own pending/approved guest requests
DROP POLICY IF EXISTS "Members can delete their own guest requests" ON public.guest_requests;
CREATE POLICY "Members can delete their own guest requests"
ON public.guest_requests
FOR DELETE
TO authenticated
USING (requesting_user_id = auth.uid());