-- Fix has_role() to allow service_role context (triggers, edge functions)
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
      AND (_user_id = auth.uid() OR auth.role() = 'service_role')
  );
$$;

-- Remove rsvps from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.rsvps;