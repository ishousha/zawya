
-- ============================================================
-- Helper: log_admin_change
-- Only logs when the caller is an admin or moderator (skips
-- service_role and unauthenticated writes, and member-only writes
-- such as a member creating a guest_request).
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_admin_change(
  _action text,
  _target_id uuid,
  _target_label text,
  _details jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RETURN; END IF;
  IF NOT (
    public.has_role(_uid, 'admin'::app_role)
    OR public.has_role(_uid, 'moderator'::app_role)
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.admin_activity_log
    (actor_id, action, target_user_id, target_user_name, details)
  VALUES
    (_uid, _action, _target_id, _target_label, COALESCE(_details, '{}'::jsonb));
END;
$$;

-- ============================================================
-- EVENTS
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_event_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _changed jsonb := '{}'::jsonb;
  _action  text;
  _label   text;
  _fields  text[] := ARRAY[
    'title','date_time','end_date_time','location','address','venue_id',
    'capacity','waitlist_capacity','status','published','event_type_id',
    'host_id','is_hybrid','virtual_link','online_link','zoom_link',
    'ticket_fee','mureeds_only','age_group','audience_gender',
    'cover_photo_url','maps_url','description','allow_guests',
    'scheduled_publish_at','has_potluck'
  ];
  _f text;
  _old jsonb;
  _new jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_change(
      'event_create', NEW.id, NEW.title,
      jsonb_build_object(
        'date_time', NEW.date_time,
        'status', NEW.status,
        'published', NEW.published,
        'capacity', NEW.capacity
      )
    );
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_change(
      'event_delete', OLD.id, OLD.title,
      jsonb_build_object('date_time', OLD.date_time, 'status', OLD.status)
    );
    RETURN OLD;
  END IF;

  -- UPDATE: compute diff
  _old := to_jsonb(OLD);
  _new := to_jsonb(NEW);
  FOREACH _f IN ARRAY _fields LOOP
    IF (_old -> _f) IS DISTINCT FROM (_new -> _f) THEN
      _changed := _changed || jsonb_build_object(_f,
        jsonb_build_object('from', _old -> _f, 'to', _new -> _f));
    END IF;
  END LOOP;

  IF _changed = '{}'::jsonb THEN
    RETURN NEW;
  END IF;

  -- Pick a meaningful action label
  IF OLD.published IS DISTINCT FROM NEW.published THEN
    _action := CASE WHEN NEW.published THEN 'event_publish' ELSE 'event_unpublish' END;
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    _action := 'event_cancel';
  ELSIF OLD.status IS DISTINCT FROM NEW.status AND OLD.status = 'cancelled' THEN
    _action := 'event_reactivate';
  ELSE
    _action := 'event_update';
  END IF;

  _label := COALESCE(NEW.title, OLD.title);
  PERFORM public.log_admin_change(_action, NEW.id, _label, jsonb_build_object('changed', _changed));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_event_changes ON public.events;
CREATE TRIGGER trg_log_event_changes
AFTER INSERT OR UPDATE OR DELETE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.log_event_changes();

-- ============================================================
-- Generic helper for simple tables: name + select fields
-- We use one function per table to keep label/fields explicit.
-- ============================================================

-- VENUES
CREATE OR REPLACE FUNCTION public.log_venue_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _changed jsonb := '{}'::jsonb; _f text; _fields text[] := ARRAY['name','address','area_hint','maps_url'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_change('venue_create', NEW.id, NEW.name,
      jsonb_build_object('address', NEW.address));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_change('venue_delete', OLD.id, OLD.name,
      jsonb_build_object('address', OLD.address));
    RETURN OLD;
  ELSE
    FOREACH _f IN ARRAY _fields LOOP
      IF (to_jsonb(OLD) -> _f) IS DISTINCT FROM (to_jsonb(NEW) -> _f) THEN
        _changed := _changed || jsonb_build_object(_f,
          jsonb_build_object('from', to_jsonb(OLD) -> _f, 'to', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changed <> '{}'::jsonb THEN
      PERFORM public.log_admin_change('venue_update', NEW.id, NEW.name,
        jsonb_build_object('changed', _changed));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_venue_changes ON public.venues;
CREATE TRIGGER trg_log_venue_changes
AFTER INSERT OR UPDATE OR DELETE ON public.venues
FOR EACH ROW EXECUTE FUNCTION public.log_venue_changes();

-- EVENT_TYPES
CREATE OR REPLACE FUNCTION public.log_event_type_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _changed jsonb := '{}'::jsonb; _f text;
  _fields text[] := ARRAY['name','icon','requires_location','allows_potluck','is_virtual','display_order','default_age_group'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_change('event_type_create', NEW.id, NEW.name, '{}'::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_change('event_type_delete', OLD.id, OLD.name, '{}'::jsonb);
    RETURN OLD;
  ELSE
    FOREACH _f IN ARRAY _fields LOOP
      IF (to_jsonb(OLD) -> _f) IS DISTINCT FROM (to_jsonb(NEW) -> _f) THEN
        _changed := _changed || jsonb_build_object(_f,
          jsonb_build_object('from', to_jsonb(OLD) -> _f, 'to', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changed <> '{}'::jsonb THEN
      PERFORM public.log_admin_change('event_type_update', NEW.id, NEW.name,
        jsonb_build_object('changed', _changed));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_event_type_changes ON public.event_types;
CREATE TRIGGER trg_log_event_type_changes
AFTER INSERT OR UPDATE OR DELETE ON public.event_types
FOR EACH ROW EXECUTE FUNCTION public.log_event_type_changes();

-- SPEAKERS
CREATE OR REPLACE FUNCTION public.log_speaker_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _changed jsonb := '{}'::jsonb; _f text;
  _fields text[] := ARRAY['name','bio','image_url'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_change('speaker_create', NEW.id, NEW.name, '{}'::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_change('speaker_delete', OLD.id, OLD.name, '{}'::jsonb);
    RETURN OLD;
  ELSE
    FOREACH _f IN ARRAY _fields LOOP
      IF (to_jsonb(OLD) -> _f) IS DISTINCT FROM (to_jsonb(NEW) -> _f) THEN
        _changed := _changed || jsonb_build_object(_f,
          jsonb_build_object('from', to_jsonb(OLD) -> _f, 'to', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changed <> '{}'::jsonb THEN
      PERFORM public.log_admin_change('speaker_update', NEW.id, NEW.name,
        jsonb_build_object('changed', _changed));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_speaker_changes ON public.speakers;
CREATE TRIGGER trg_log_speaker_changes
AFTER INSERT OR UPDATE OR DELETE ON public.speakers
FOR EACH ROW EXECUTE FUNCTION public.log_speaker_changes();

-- EVENT_SPEAKERS (assign/unassign)
CREATE OR REPLACE FUNCTION public.log_event_speaker_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _event_title text; _speaker_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT title INTO _event_title FROM public.events WHERE id = NEW.event_id;
    SELECT name  INTO _speaker_name FROM public.speakers WHERE id = NEW.speaker_id;
    PERFORM public.log_admin_change('speaker_assign', NEW.event_id,
      COALESCE(_event_title, 'event'),
      jsonb_build_object('speaker_id', NEW.speaker_id, 'speaker_name', _speaker_name));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT title INTO _event_title FROM public.events WHERE id = OLD.event_id;
    SELECT name  INTO _speaker_name FROM public.speakers WHERE id = OLD.speaker_id;
    PERFORM public.log_admin_change('speaker_unassign', OLD.event_id,
      COALESCE(_event_title, 'event'),
      jsonb_build_object('speaker_id', OLD.speaker_id, 'speaker_name', _speaker_name));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_event_speaker_changes ON public.event_speakers;
CREATE TRIGGER trg_log_event_speaker_changes
AFTER INSERT OR DELETE ON public.event_speakers
FOR EACH ROW EXECUTE FUNCTION public.log_event_speaker_changes();

-- EVENT_SIGN_UP_ITEMS
CREATE OR REPLACE FUNCTION public.log_signup_item_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _changed jsonb := '{}'::jsonb; _f text;
  _fields text[] := ARRAY['item_name','quantity_limit','order_index'];
  _event_title text; _event_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT title INTO _event_title FROM public.events WHERE id = NEW.event_id;
    PERFORM public.log_admin_change('signup_item_create', NEW.event_id,
      COALESCE(_event_title, 'event'),
      jsonb_build_object('item_name', NEW.item_name, 'quantity_limit', NEW.quantity_limit));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT title INTO _event_title FROM public.events WHERE id = OLD.event_id;
    PERFORM public.log_admin_change('signup_item_delete', OLD.event_id,
      COALESCE(_event_title, 'event'),
      jsonb_build_object('item_name', OLD.item_name));
    RETURN OLD;
  ELSE
    FOREACH _f IN ARRAY _fields LOOP
      IF (to_jsonb(OLD) -> _f) IS DISTINCT FROM (to_jsonb(NEW) -> _f) THEN
        _changed := _changed || jsonb_build_object(_f,
          jsonb_build_object('from', to_jsonb(OLD) -> _f, 'to', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changed <> '{}'::jsonb THEN
      SELECT title INTO _event_title FROM public.events WHERE id = NEW.event_id;
      PERFORM public.log_admin_change('signup_item_update', NEW.event_id,
        COALESCE(_event_title, 'event'),
        jsonb_build_object('item_name', NEW.item_name, 'changed', _changed));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_signup_item_changes ON public.event_sign_up_items;
CREATE TRIGGER trg_log_signup_item_changes
AFTER INSERT OR UPDATE OR DELETE ON public.event_sign_up_items
FOR EACH ROW EXECUTE FUNCTION public.log_signup_item_changes();

-- RESOURCES
CREATE OR REPLACE FUNCTION public.log_resource_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _changed jsonb := '{}'::jsonb; _f text;
  _fields text[] := ARRAY['title','description','category','resource_type','file_url','file_name'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_change('resource_create', NEW.id, NEW.title,
      jsonb_build_object('category', NEW.category, 'resource_type', NEW.resource_type));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_change('resource_delete', OLD.id, OLD.title,
      jsonb_build_object('category', OLD.category));
    RETURN OLD;
  ELSE
    FOREACH _f IN ARRAY _fields LOOP
      IF (to_jsonb(OLD) -> _f) IS DISTINCT FROM (to_jsonb(NEW) -> _f) THEN
        _changed := _changed || jsonb_build_object(_f,
          jsonb_build_object('from', to_jsonb(OLD) -> _f, 'to', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changed <> '{}'::jsonb THEN
      PERFORM public.log_admin_change('resource_update', NEW.id, NEW.title,
        jsonb_build_object('changed', _changed));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_resource_changes ON public.resources;
CREATE TRIGGER trg_log_resource_changes
AFTER INSERT OR UPDATE OR DELETE ON public.resources
FOR EACH ROW EXECUTE FUNCTION public.log_resource_changes();

-- ANNOUNCEMENTS
CREATE OR REPLACE FUNCTION public.log_announcement_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _changed jsonb := '{}'::jsonb; _f text;
  _fields text[] := ARRAY['title','message','link_url','link_label','variant','active','starts_at','ends_at'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_change('announcement_create', NEW.id, NEW.title,
      jsonb_build_object('active', NEW.active, 'variant', NEW.variant));
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_change('announcement_delete', OLD.id, OLD.title, '{}'::jsonb);
    RETURN OLD;
  ELSE
    FOREACH _f IN ARRAY _fields LOOP
      IF (to_jsonb(OLD) -> _f) IS DISTINCT FROM (to_jsonb(NEW) -> _f) THEN
        _changed := _changed || jsonb_build_object(_f,
          jsonb_build_object('from', to_jsonb(OLD) -> _f, 'to', to_jsonb(NEW) -> _f));
      END IF;
    END LOOP;
    IF _changed <> '{}'::jsonb THEN
      PERFORM public.log_admin_change('announcement_update', NEW.id, NEW.title,
        jsonb_build_object('changed', _changed));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_announcement_changes ON public.announcements;
CREATE TRIGGER trg_log_announcement_changes
AFTER INSERT OR UPDATE OR DELETE ON public.announcements
FOR EACH ROW EXECUTE FUNCTION public.log_announcement_changes();

-- FAMILIES
CREATE OR REPLACE FUNCTION public.log_family_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.log_admin_change('family_create', NEW.id, NEW.name, '{}'::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.log_admin_change('family_delete', OLD.id, OLD.name, '{}'::jsonb);
    RETURN OLD;
  ELSE
    IF OLD.name IS DISTINCT FROM NEW.name THEN
      PERFORM public.log_admin_change('family_update', NEW.id, NEW.name,
        jsonb_build_object('changed',
          jsonb_build_object('name', jsonb_build_object('from', OLD.name, 'to', NEW.name))));
    END IF;
    RETURN NEW;
  END IF;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_family_changes ON public.families;
CREATE TRIGGER trg_log_family_changes
AFTER INSERT OR UPDATE OR DELETE ON public.families
FOR EACH ROW EXECUTE FUNCTION public.log_family_changes();

-- GUEST_REQUESTS (only admin/mod actions: approve, reject, delete by admin)
CREATE OR REPLACE FUNCTION public.log_guest_request_changes()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _event_title text; _action text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status
       AND OLD.status = 'pending'
       AND NEW.status IN ('approved','rejected') THEN
      SELECT title INTO _event_title FROM public.events WHERE id = NEW.event_id;
      _action := CASE WHEN NEW.status = 'approved'
                      THEN 'guest_request_approve'
                      ELSE 'guest_request_reject' END;
      PERFORM public.log_admin_change(_action, NEW.event_id,
        COALESCE(_event_title, 'event'),
        jsonb_build_object(
          'guest_name', NEW.guest_name,
          'guest_request_id', NEW.id,
          'requested_by', NEW.requesting_user_id
        ));
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    SELECT title INTO _event_title FROM public.events WHERE id = OLD.event_id;
    PERFORM public.log_admin_change('guest_request_delete', OLD.event_id,
      COALESCE(_event_title, 'event'),
      jsonb_build_object(
        'guest_name', OLD.guest_name,
        'status', OLD.status,
        'guest_request_id', OLD.id
      ));
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_log_guest_request_changes ON public.guest_requests;
CREATE TRIGGER trg_log_guest_request_changes
AFTER UPDATE OR DELETE ON public.guest_requests
FOR EACH ROW EXECUTE FUNCTION public.log_guest_request_changes();
