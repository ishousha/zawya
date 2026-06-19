CREATE OR REPLACE FUNCTION public.get_user_analytics_export(
  date_from timestamptz DEFAULT NULL,
  date_to   timestamptz DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  email text,
  phone text,
  whatsapp text,
  gender text,
  age integer,
  family_name text,
  member_since date,
  is_mureed boolean,
  dependent_count integer,
  total_rsvps integer,
  total_checkins integer,
  no_shows integer,
  checkin_rate numeric,
  guests_brought integer,
  virtual_events_attended integer,
  inperson_events_attended integer,
  last_checkin_date date,
  days_since_checkin integer,
  engagement_status text,
  avg_events_per_month numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH dep AS (
    SELECT p.id AS profile_id, COUNT(DISTINCT d.id)::int AS dependent_count
    FROM public.profiles p
    LEFT JOIN public.dependents d
      ON d.parent_id = p.id
      OR (p.family_id IS NOT NULL AND d.family_id = p.family_id)
    GROUP BY p.id
  ),
  rsvp_agg AS (
    SELECT
      p.id AS profile_id,
      COUNT(DISTINCT r.id) FILTER (
        WHERE r.status::text <> 'cancelled' AND COALESCE(r.is_waitlisted,false) = false
      )::int AS total_rsvps,
      COUNT(DISTINCT r.id) FILTER (WHERE r.checked_in = true)::int AS total_checkins,
      COUNT(DISTINCT r.id) FILTER (
        WHERE r.checked_in = false
          AND r.status::text <> 'cancelled'
          AND COALESCE(r.is_waitlisted,false) = false
      )::int AS no_shows,
      COALESCE(SUM(
        CASE WHEN r.status::text <> 'cancelled' AND COALESCE(r.is_waitlisted,false) = false
             THEN COALESCE(r.guests_count,0) ELSE 0 END
      ),0)::int AS guests_brought,
      COUNT(DISTINCT r.id) FILTER (
        WHERE r.checked_in = true
          AND (e.zoom_link IS NOT NULL OR e.virtual_link IS NOT NULL OR e.online_link IS NOT NULL)
      )::int AS virtual_events_attended,
      COUNT(DISTINCT r.id) FILTER (
        WHERE r.checked_in = true
          AND e.zoom_link IS NULL AND e.virtual_link IS NULL AND e.online_link IS NULL
      )::int AS inperson_events_attended,
      MAX(r.updated_at) FILTER (WHERE r.checked_in = true)::date AS last_checkin_date
    FROM public.profiles p
    LEFT JOIN public.rsvps r
      ON r.user_id = p.id
     AND (date_from IS NULL OR r.created_at >= date_from)
     AND (date_to   IS NULL OR r.created_at <= date_to)
    LEFT JOIN public.events e
      ON e.id = r.event_id
     AND (date_from IS NULL OR e.date_time >= date_from)
     AND (date_to   IS NULL OR e.date_time <= date_to)
    GROUP BY p.id
  )
  SELECT
    p.id AS user_id,
    p.name AS full_name,
    p.email,
    p.phone,
    p.whatsapp_number AS whatsapp,
    p.gender,
    CASE WHEN p.date_of_birth IS NULL THEN NULL
         ELSE EXTRACT(YEAR FROM AGE(p.date_of_birth))::int END AS age,
    p.family_name,
    p.created_at::date AS member_since,
    p.is_mureed,
    COALESCE(dep.dependent_count, 0) AS dependent_count,
    COALESCE(ra.total_rsvps, 0) AS total_rsvps,
    COALESCE(ra.total_checkins, 0) AS total_checkins,
    COALESCE(ra.no_shows, 0) AS no_shows,
    CASE WHEN COALESCE(ra.total_rsvps,0) = 0 THEN 0::numeric(5,2)
         ELSE ROUND((ra.total_checkins::numeric / ra.total_rsvps::numeric) * 100, 2)
    END AS checkin_rate,
    COALESCE(ra.guests_brought, 0) AS guests_brought,
    COALESCE(ra.virtual_events_attended, 0) AS virtual_events_attended,
    COALESCE(ra.inperson_events_attended, 0) AS inperson_events_attended,
    ra.last_checkin_date,
    CASE WHEN ra.last_checkin_date IS NULL THEN NULL
         ELSE (CURRENT_DATE - ra.last_checkin_date)::int END AS days_since_checkin,
    CASE
      WHEN ra.last_checkin_date IS NULL THEN 'Never Attended'
      WHEN (CURRENT_DATE - ra.last_checkin_date) <= 30 THEN 'Active'
      WHEN (CURRENT_DATE - ra.last_checkin_date) <= 90 THEN 'Lapsed'
      ELSE 'Inactive'
    END AS engagement_status,
    ROUND(
      COALESCE(ra.total_checkins,0)::numeric
      / GREATEST(
          CASE
            WHEN date_from IS NOT NULL AND date_to IS NOT NULL
              THEN GREATEST(EXTRACT(EPOCH FROM (date_to - date_from)) / (60*60*24*30.0), 1)::numeric
            ELSE GREATEST(EXTRACT(EPOCH FROM (now() - p.created_at)) / (60*60*24*30.0), 1)::numeric
          END,
          1::numeric
        ),
      2
    ) AS avg_events_per_month
  FROM public.profiles p
  LEFT JOIN dep ON dep.profile_id = p.id
  LEFT JOIN rsvp_agg ra ON ra.profile_id = p.id
  ORDER BY p.name NULLS LAST;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_analytics_export(timestamptz, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_analytics_export(timestamptz, timestamptz) TO authenticated;