
CREATE TABLE public.admin_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid NOT NULL,
  action text NOT NULL,
  target_user_id uuid,
  target_user_name text,
  target_user_email text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view activity log"
  ON public.admin_activity_log
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can insert activity log"
  ON public.admin_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Service role can insert activity log"
  ON public.admin_activity_log
  FOR INSERT
  TO public
  WITH CHECK (auth.role() = 'service_role'::text);

CREATE INDEX idx_admin_activity_log_created_at ON public.admin_activity_log (created_at DESC);
