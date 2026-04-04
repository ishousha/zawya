
-- Create enum for guest request status
CREATE TYPE public.guest_request_status AS ENUM ('pending', 'approved', 'rejected');

-- Create guest_requests table
CREATE TABLE public.guest_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  requesting_user_id UUID NOT NULL,
  guest_name TEXT NOT NULL,
  guest_phone TEXT,
  status guest_request_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.guest_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own guest requests"
ON public.guest_requests FOR SELECT
TO authenticated
USING (auth.uid() = requesting_user_id);

CREATE POLICY "Users can create own guest requests"
ON public.guest_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requesting_user_id);

CREATE POLICY "Users can delete own pending guest requests"
ON public.guest_requests FOR DELETE
TO authenticated
USING (auth.uid() = requesting_user_id AND status = 'pending');

CREATE POLICY "Admins can view all guest requests"
ON public.guest_requests FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update guest requests"
ON public.guest_requests FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete guest requests"
ON public.guest_requests FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Timestamp trigger
CREATE TRIGGER update_guest_requests_updated_at
BEFORE UPDATE ON public.guest_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
