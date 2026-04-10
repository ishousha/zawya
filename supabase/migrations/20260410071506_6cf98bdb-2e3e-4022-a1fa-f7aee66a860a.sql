ALTER TABLE public.guest_requests
  ADD CONSTRAINT guest_requests_requesting_user_id_fkey
  FOREIGN KEY (requesting_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;