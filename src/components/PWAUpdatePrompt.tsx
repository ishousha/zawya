import { useEffect, useRef } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

/**
 * Listens for new service worker builds and prompts the user with a toast
 * to reload. Also re-checks for updates whenever the tab regains focus.
 *
 * Disabled inside Lovable preview iframes (matches main.tsx guard).
 */
export default function PWAUpdatePrompt() {
  const isPreviewHost =
    typeof window !== "undefined" &&
    (window.location.hostname.includes("id-preview--") ||
      window.location.hostname.includes("lovableproject.com"));

  const isInIframe = (() => {
    try {
      return typeof window !== "undefined" && window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const enabled = !isPreviewHost && !isInIframe;

  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const toastShownRef = useRef(false);

  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: enabled,
    onRegisteredSW(_url, registration) {
      registrationRef.current = registration;
    },
    onRegisterError(error) {
      console.warn("[PWA] SW registration failed:", error);
    },
  });

  // Show a single sticky toast when a new build is detected
  useEffect(() => {
    if (!needRefresh || toastShownRef.current) return;
    toastShownRef.current = true;

    toast("A new version of Zawya is available", {
      description: "Tap refresh to load the latest improvements.",
      duration: Infinity,
      action: (
        <Button
          size="sm"
          onClick={() => {
            updateServiceWorker(true);
          }}
          className="gap-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      ),
      onDismiss: () => {
        toastShownRef.current = false;
        setNeedRefresh(false);
      },
    });
  }, [needRefresh, setNeedRefresh, updateServiceWorker]);

  // Re-check for updates whenever the tab regains focus / becomes visible
  useEffect(() => {
    if (!enabled) return;

    const checkForUpdate = () => {
      registrationRef.current?.update().catch(() => {});
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") checkForUpdate();
    };

    window.addEventListener("focus", checkForUpdate);
    document.addEventListener("visibilitychange", onVisibility);

    // Periodic safety check every 30 minutes for users who keep the app open
    const interval = window.setInterval(checkForUpdate, 30 * 60 * 1000);

    return () => {
      window.removeEventListener("focus", checkForUpdate);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(interval);
    };
  }, [enabled]);

  return null;
}

/**
 * Manual escape hatch: clears all caches, unregisters the service worker,
 * and hard-reloads the page. Use from a settings/profile screen.
 */
export async function forceRefreshApp() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (e) {
    console.warn("[PWA] forceRefreshApp cleanup failed:", e);
  } finally {
    // Cache-bust the HTML shell to guarantee a fresh document
    const url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString());
    window.location.replace(url.toString());
  }
}
