import { useState, useEffect } from "react";
import { X, Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallAppBanner() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showIOSPrompt, setShowIOSPrompt] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true;

  useEffect(() => {
    if (isStandalone) return;

    // Check if previously dismissed this session
    if (sessionStorage.getItem("pwa-banner-dismissed")) {
      setDismissed(true);
      return;
    }

    // Android / Desktop
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS detection
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;
    const isSafari = /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(navigator.userAgent);
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
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  return (
    <div className="relative mx-4 mt-4 rounded-xl border border-primary/20 bg-card p-4 shadow-sm">
      <button
        onClick={handleDismiss}
        className="absolute right-3 top-3 rounded-full p-1 text-muted-foreground hover:bg-muted"
        aria-label="Dismiss"
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
              <span className="font-semibold text-foreground">Share</span>{" "}
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
