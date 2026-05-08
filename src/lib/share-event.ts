import { toast } from "sonner";

export function getEventShareUrl(eventId: string): string {
  return `${window.location.origin}/events/${eventId}`;
}

export async function copyEventLink(eventId: string): Promise<void> {
  const url = getEventShareUrl(eventId);
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      // Fallback for insecure contexts / older browsers
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (!ok) throw new Error("execCommand copy failed");
    }
    toast.success("Event link copied to clipboard!");
  } catch {
    toast.error("Could not copy link");
  }
}
