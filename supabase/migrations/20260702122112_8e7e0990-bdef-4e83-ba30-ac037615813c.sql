
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;

UPDATE public.events
SET cancelled_at = COALESCE(updated_at, now())
WHERE status = 'cancelled' AND cancelled_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_events_cancelled_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'cancelled' AND (OLD.status IS DISTINCT FROM 'cancelled') THEN
    NEW.cancelled_at := now();
  ELSIF NEW.status <> 'cancelled' AND OLD.status = 'cancelled' THEN
    NEW.cancelled_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_events_cancelled_at ON public.events;
CREATE TRIGGER set_events_cancelled_at
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.set_events_cancelled_at();
