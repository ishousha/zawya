REVOKE ALL ON FUNCTION public.create_my_family(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_my_family(text) TO authenticated;