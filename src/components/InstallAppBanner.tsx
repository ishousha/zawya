import { useState, useEffect } from "react";
import { X, Download, Share, Compass, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "pwa-banner-dismissed-at";
const DISMISS_DAYS = 7;

type Mode =
  | "android-prompt" // beforeinstallprompt available — real Install button works
  | "ios-safari" // iOS Safari — show Share → Add to Home Screen steps
  | "ios-inapp" // iOS but inside an in-app browser (Gmail, Instagram, etc.) or Chrome iOS
  | "android-inapp" // Android in-app browser without beforeinstallprompt
  | null;

function wasDismissedRecently(): boolean {
  const raw = localStorage.getItem(DISMISS_KEY);
  if (!raw) return false;
  const dismissedAt = Number(raw);
  return Date.now() - dismissedAt < DISMISS_DAYS * 24 * 60 * 60 * 1000;
}

function detectInAppBrowser(ua: string): boolean {
  // Common in-app browser markers
  return /FBAN|FBAV|Instagram|Line|Twitter|WhatsApp|GSA\/|FxiOS|EdgiOS|OPiOS|MicroMessenger|Snapchat|TikTok/i.test(
    ua,
  );
}

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<Mode>(null);
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

    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isAndroid = /Android/.test(ua);
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    const isChromeAndroid = isAndroid && /Chrome/.test(ua) && !/wv\)/.test(ua);
    const inApp = detectInAppBrowser(ua) || /; wv\)/.test(ua);

    // Android / Desktop — intercept native mini-infobar (this is the only path
    // where a real one-tap Install button works)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setMode("android-prompt");
    };
    window.addEventListener("beforeinstallprompt", handler);

    if (isIOS) {
      if (inApp || !isSafari) {
        setMode("ios-inapp");
      } else {
        setMode("ios-safari");
      }
    } else if (isAndroid && (inApp || !isChromeAndroid)) {
      // Android but not Chrome / in-app browser — beforeinstallprompt won't fire
      setMode("android-inapp");
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  if (isStandalone || dismissed || !mode) return null;

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

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
    } catch {
      /* ignore */
    }
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

      {/* Header */}
      <div className="mb-3 flex items-center gap-3 pr-6">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Download className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="font-heading text-sm font-semibold text-foreground">
            Add Zawya to your Home Screen
          </p>
          <p className="text-xs text-muted-foreground">
            Open like a real app, faster and offline-ready
          </p>
        </div>
      </div>

      {/* Android — real install button works */}
      {mode === "android-prompt" && (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">
            Tap Install and confirm in the popup.
          </p>
          <Button size="sm" onClick={handleInstall}>
            Install
          </Button>
        </div>
      )}

      {/* iOS Safari — must use Share menu */}
      {mode === "ios-safari" && (
        <div className="space-y-2 rounded-lg bg-muted/50 p-3">
          <p className="text-xs font-medium text-foreground">
            iPhone needs 2 quick steps — there's no Install button:
          </p>
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">1.</span>
              <span>
                Tap the{" "}
                <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                  <Share className="inline h-3.5 w-3.5" /> Share
                </span>{" "}
                button at the bottom of Safari.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">2.</span>
              <span>
                Scroll and tap{" "}
                <span className="font-semibold text-foreground">
                  Add to Home Screen
                </span>
                .
              </span>
            </li>
          </ol>
        </div>
      )}

      {/* iOS in-app browser (Gmail, Instagram, Chrome iOS, etc.) */}
      {mode === "ios-inapp" && (
        <div className="space-y-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-amber-600" />
            Open this page in Safari first
          </p>
          <p className="text-xs text-muted-foreground">
            You're viewing Zawya inside another app's browser, which can't install apps.
          </p>
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">1.</span>
              <span>
                Tap the menu (
                <MoreVertical className="inline h-3.5 w-3.5" />
                ) and choose{" "}
                <span className="font-semibold text-foreground">Open in Safari</span>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">2.</span>
              <span>
                In Safari, tap{" "}
                <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                  <Share className="inline h-3.5 w-3.5" /> Share
                </span>{" "}
                →{" "}
                <span className="font-semibold text-foreground">
                  Add to Home Screen
                </span>
                .
              </span>
            </li>
          </ol>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 h-7 text-xs"
            onClick={handleCopyLink}
          >
            Copy link
          </Button>
        </div>
      )}

      {/* Android in-app browser */}
      {mode === "android-inapp" && (
        <div className="space-y-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 p-3">
          <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <Compass className="h-4 w-4 text-amber-600" />
            Open this page in Chrome first
          </p>
          <p className="text-xs text-muted-foreground">
            You're viewing Zawya inside another app's browser, which can't install apps.
          </p>
          <ol className="space-y-1.5 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">1.</span>
              <span>
                Tap the menu (
                <MoreVertical className="inline h-3.5 w-3.5" />
                ) and choose{" "}
                <span className="font-semibold text-foreground">Open in Chrome</span>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-primary">2.</span>
              <span>
                In Chrome, tap the menu (
                <MoreVertical className="inline h-3.5 w-3.5" />) →{" "}
                <span className="font-semibold text-foreground">
                  Add to Home screen
                </span>
                .
              </span>
            </li>
          </ol>
          <Button
            size="sm"
            variant="outline"
            className="mt-1 h-7 text-xs"
            onClick={handleCopyLink}
          >
            Copy link
          </Button>
        </div>
      )}
    </div>
  );
}

/** Button to reset the 7-day install banner dismissal timer — admin only */
export function ClearInstallDismissButton() {
  return (
    <button
      onClick={() => {
        localStorage.removeItem(DISMISS_KEY);
        window.location.reload();
      }}
      className="w-full rounded-md border border-border bg-muted px-3 py-2 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
    >
      🔧 Reset Install Banner Dismissal
    </button>
  );
}
