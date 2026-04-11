import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-banner-dismissed-at";
const DISMISS_DAYS = 7;

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true);

  useEffect(() => {
    if (isStandalone || wasDismissedRecently()) {
      setDismissed(true);
      return;
    }

    // Android / Desktop — intercept native mini-infobar
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari detection (not in standalone, not a Chrome/Firefox wrapper)
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari =
      /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    if (isIOS && isSafari) {
      setShowIOSPrompt(true);
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  if (isStandalone || dismissed) return null;
  if (!deferredPrompt && !showIOSPrompt) return null;

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
      setDismissed(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  return (
    <div className="relative mx-4 mt-4 rounded-xl border border-primary/20 bg-card p-4 shadow-sm animate-fade-in">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label="Dismiss install banner"
      >
        <X className="h-4 w-4" />
      </button>

      {deferredPrompt ? (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Download className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-heading text-sm font-semibold text-foreground">
              Install Zawya
            </p>
            <p className="text-xs text-muted-foreground">
              Add to your home screen for quick access
            </p>
          </div>
          <Button size="sm" onClick={handleInstall}>
            Install
          </Button>
        </div>
      ) : showIOSPrompt ? (
        <div className="pr-6">
          <div className="mb-2 flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Download className="h-5 w-5 text-primary" />
            </div>
            <p className="font-heading text-sm font-semibold text-foreground">
              Install Zawya
            </p>
          </div>
          <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
            <Share className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tap the{" "}
              <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                <Share className="inline h-3.5 w-3.5" /> Share
              </span>{" "}
              button at the bottom of your screen, then select{" "}
              <span className="font-semibold text-foreground">
                Add to Home Screen
              </span>
              .
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** Dev-only button to reset the 7-day install banner dismissal timer */
export function ClearInstallDismissButton() {
  if (import.meta.env.PROD) return null;

  return (
    <button
      onClick={() => {
        localStorage.removeItem(DISMISS_KEY);
        window.location.reload();
      }}
      className="fixed bottom-20 right-3 z-50 rounded-md bg-destructive px-3 py-1.5 text-xs font-medium text-destructive-foreground shadow-md hover:opacity-90"
    >
      🔧 Reset Install Banner
    </button>
  );
}
