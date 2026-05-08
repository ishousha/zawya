-- 1) Revoke EXECUTE on trigger-only and internal-only functions from anon/authenticated/PUBLIC
DO $$
DECLARE
  fn text;
  trigger_fns text[] := ARRAY[
    'enforce_event_gender_audience()',
    'handle_new_user()',
    'notify_family_on_leave()',
    'notify_on_account_approved()',
    'notify_on_event_cancelled()',
    'notify_on_guest_request_update()',
    'prevent_profile_field_escalation()',
    'prevent_role_self_escalation()',
    'promote_waitlisted_on_cancel()',
    'promote_waitlisted_on_capacity_increase()',
    'update_updated_at_column()'
  ];
  internal_fns text[] := ARRAY[
    'enqueue_email(text, jsonb)',
    'read_email_batch(text, integer, integer)',
    'delete_email(text, bigint)',
    'move_to_dlq(text, text, bigint, jsonb)'
  ];
BEGIN
  FOREACH fn IN ARRAY trigger_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
  FOREACH fn IN ARRAY internal_fns LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
END$$;

-- 2) Revoke anon EXECUTE on RPC-style functions (still callable by authenticated users)
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.accept_family_invite(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_event_potluck_menu(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_event_rsvp_counts(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_event_signup_claims(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_my_family_id() FROM anon;
REVOKE EXECUTE ON FUNCTION public.guest_has_rsvp(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_checkin_pin(uuid, text) FROM anon;

-- 3) Drop overly broad public-bucket listing policies. Public CDN URLs still work.
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view event covers" ON storage.objects;