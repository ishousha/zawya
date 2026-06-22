import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/runtime-client";

/**
 * Resolves /r/:shortCode → /library/:id by looking up the short_code in the
 * resources table. Assumes a session is present (unauth users hit LoginPage
 * via AppRoutes' deep-link capture and come back here after sign-in).
 */
export default function ResourceShortLinkRedirect() {
  const { shortCode } = useParams<{ shortCode: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!shortCode) {
        navigate("/library", { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("resources")
        .select("id")
        .eq("short_code", shortCode)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        toast.error("Resource link invalid.");
        navigate("/library", { replace: true });
        return;
      }
      navigate(`/library/${data.id}`, { replace: true });
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
