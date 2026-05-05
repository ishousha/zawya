REVOKE EXECUTE ON FUNCTION public.get_event_potluck_menu(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_event_potluck_menu(uuid) TO authenticated;