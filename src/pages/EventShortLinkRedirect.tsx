import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

/**
 * Resolves /e/:shortCode → /events/:id by looking up the short_code in the
 * events table. Assumes a session is present (unauthenticated users hit the
 * Login screen via AppRoutes' deep-link capture and are redirected back here
 * after sign-in).
 */
export default function EventShortLinkRedirect() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shortCode) {
        navigate("/", { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("events")
        .select("id")
        .eq("short_code", shortCode)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Event link invalid.");
        navigate("/", { replace: true });
        return;
      }
      navigate(`/events/${data.id}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [shortCode, navigate]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
