
-- Notifications table for in-app alerts
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Users can mark their own notifications as read
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Allow inserts from service role (edge functions) and triggers
CREATE POLICY "Service role can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Database function to notify family members when someone leaves
CREATE OR REPLACE FUNCTION public.notify_family_on_leave()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _member RECORD;
  _leaver_name TEXT;
  _family_name TEXT;
BEGIN
  -- Only fire when family_id is being set to NULL
  IF OLD.family_id IS NOT NULL AND NEW.family_id IS NULL THEN
    _leaver_name := COALESCE(OLD.name, 'A member');
    
    SELECT name INTO _family_name FROM families WHERE id = OLD.family_id;
    
    -- Insert notification for each remaining family member
    FOR _member IN
      SELECT id FROM profiles
      WHERE family_id = OLD.family_id AND id != OLD.id
    LOOP
      INSERT INTO notifications (user_id, title, message, type, metadata)
      VALUES (
        _member.id,
        'Family member left',
        _leaver_name || ' has left ' || COALESCE(_family_name, 'the family group') || '.',
        'family',
        jsonb_build_object('leaver_name', _leaver_name, 'family_id', OLD.family_id)
      );
    END LOOP;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_family_leave
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_family_on_leave();
