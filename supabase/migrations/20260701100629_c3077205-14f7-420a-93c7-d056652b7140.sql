REVOKE ALL ON FUNCTION public.create_my_family(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_my_family(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_my_family(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_my_family(text) TO service_role;