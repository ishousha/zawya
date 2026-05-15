import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import { getSupabaseEnv } from "@/integrations/supabase/runtime-client";
import "./index.css";

Sentry.init({
  dsn: "https://fe7a11eb2b7df33a29ecfb1d4e782005@o4511200607404032.ingest.de.sentry.io/4511200610418768",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 0.3,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,
  environment: getSupabaseEnv(),
  enabled: !window.location.hostname.includes("lovableproject.com"),
});

// PWA: Guard service worker registration against iframes and preview hosts
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

createRoot(document.getElementById("root")!).render(<App />);

// Staging environment banner
if (import.meta.env.VITE_IS_STAGING === "true" || 
    window.location.hostname.includes("netlify.app") ||
    window.location.hostname === "staging.zawya.app") {
  const banner = document.createElement("div");
  banner.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:99999;background:#f59e0b;color:white;text-align:center;padding:8px;font-size:14px;font-weight:600;";
  banner.textContent = "⚠️ Staging environment — data is isolated from production";
  document.body.prepend(banner);
  document.body.style.paddingTop = "40px";
}
