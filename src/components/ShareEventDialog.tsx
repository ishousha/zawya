import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Copy, Check, Mail, MessageCircle, Share2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getEventShareUrl } from "@/lib/share-event";

interface ShareTarget {
  eventId: string;
  title: string;
  shortCode?: string | null;
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function useShareEvent() {
  const [target, setTarget] = useState<ShareTarget | null>(null);

  const open = useCallback(async (eventId: string, title: string, shortCode?: string | null) => {
    const url = getEventShareUrl(eventId, shortCode);
    // Try Web Share API first (mobile / supported browsers)
    if (typeof navigator !== "undefined" && typeof (navigator as any).share === "function") {
      try {
        await (navigator as any).share({
          title,
          text: `Join us for ${title}`,
          url,
        });
        return;
      } catch (err: any) {
        // User cancelled — don't open the dialog
        if (err?.name === "AbortError") return;
        // Otherwise fall back to dialog
      }
    }
    setTarget({ eventId, title, shortCode });
  }, []);

  const dialog = (
    <ShareEventDialog
      target={target}
      onOpenChange={(o) => {
        if (!o) setTarget(null);
      }}
    />
  );

  return { open, dialog };
}

function ShareEventDialog({
  target,
  onOpenChange,
}: {
  target: ShareTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const url = target ? getEventShareUrl(target.eventId, target.shortCode) : "";
  const title = target?.title ?? "";

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopied(true);
      toast.success("Event link copied!");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toast.error("Couldn't copy automatically — long-press the link to copy.");
    }
  };

  const shareText = encodeURIComponent(`Join us for ${title}: ${url}`);
  const whatsappHref = `https://wa.me/?text=${shareText}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(title)}&body=${shareText}`;

  const canNativeShare =
    typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  const handleNativeShare = async () => {
    try {
      await (navigator as any).share({ title, text: `Join us for ${title}`, url });
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share this event</DialogTitle>
          <DialogDescription>
            Anyone with this link can view {title || "the event"} and RSVP after signing in.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => (e.currentTarget as HTMLInputElement).select()}
            className="font-mono text-xs"
          />
          <Button type="button" size="sm" onClick={handleCopy} className="gap-1.5 shrink-0">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <Button asChild variant="outline" className="gap-2">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <a href={emailHref}>
              <Mail className="h-4 w-4" /> Email
            </a>
          </Button>
          {canNativeShare && (
            <Button variant="outline" className="col-span-2 gap-2" onClick={handleNativeShare}>
              <Share2 className="h-4 w-4" /> More share options…
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
