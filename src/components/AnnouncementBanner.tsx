import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/contexts/AuthContext";
import { X, Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  variant: "info" | "success" | "warning" | string;
}

/**
 * Sticky banner shown at the top of every page. Displays the most recent
 * active announcement that the current user has not yet dismissed.
 * Once dismissed, it never reappears for that user.
 */
export default function AnnouncementBanner() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const { data: announcement } = useQuery({
    enabled: !!userId,
    queryKey: ["active-announcement", userId],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Announcement | null> => {
      // Fetch active announcements (RLS already filters by time window)
      const { data: list, error } = await supabase
        .from("announcements")
        .select("id, title, message, link_url, link_label, variant")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      if (!list || list.length === 0) return null;

      // Filter out anything this user already dismissed
      const ids = list.map((a) => a.id);
      const { data: dismissed } = await supabase
        .from("announcement_dismissals")
        .select("announcement_id")
        .in("announcement_id", ids);
      const dismissedSet = new Set((dismissed ?? []).map((d) => d.announcement_id));
      const next = list.find((a) => !dismissedSet.has(a.id));
      return (next as Announcement) ?? null;
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (announcementId: string) => {
      if (!userId) return;
      await supabase
        .from("announcement_dismissals")
        .insert({ announcement_id: announcementId, user_id: userId });
    },
    onMutate: async () => {
      // Optimistically hide
      await queryClient.cancelQueries({ queryKey: ["active-announcement", userId] });
      const prev = queryClient.getQueryData(["active-announcement", userId]);
      queryClient.setQueryData(["active-announcement", userId], null);
      return { prev };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["active-announcement", userId] });
    },
  });

  if (!announcement) return null;

  const variant = (announcement.variant as "info" | "success" | "warning") || "info";
  const Icon =
    variant === "warning" ? AlertTriangle : variant === "success" ? CheckCircle2 : Info;

  const variantClasses =
    variant === "warning"
      ? "bg-amber-500/15 text-amber-900 dark:text-amber-100 border-amber-500/30"
      : variant === "success"
        ? "bg-emerald-500/15 text-emerald-900 dark:text-emerald-100 border-emerald-500/30"
        : "bg-primary/10 text-foreground border-primary/30";

  return (
    <div
      role="status"
      className={cn(
        "sticky top-0 z-[60] w-full border-b px-3 py-2 text-sm shadow-sm",
        variantClasses,
      )}
    >
      <div className="mx-auto flex max-w-2xl items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{announcement.title}</p>
          <p className="mt-0.5 text-xs leading-snug opacity-90">{announcement.message}</p>
          {announcement.link_url && (
            <a
              href={announcement.link_url}
              target={announcement.link_url.startsWith("http") ? "_blank" : undefined}
              rel="noopener noreferrer"
              className="mt-1 inline-block text-xs font-semibold underline underline-offset-2"
            >
              {announcement.link_label || "Learn more"}
            </a>
          )}
        </div>
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => dismissMutation.mutate(announcement.id)}
          className="ml-1 -mr-1 rounded p-1 hover:bg-foreground/10 transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
