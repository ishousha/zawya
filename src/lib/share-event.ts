/**
 * Returns a canonical, shareable deep link for an event.
 * Prefers the short `/e/<code>` form when available; falls back to `/events/<uuid>`.
 * When called from inside the Lovable preview iframe or localhost, falls back
 * to the production origin so recipients land on a working URL.
 */
const PRODUCTION_ORIGIN = "https://zawya.app";

export function getEventShareUrl(eventId: string, shortCode?: string | null): string {
  let origin = PRODUCTION_ORIGIN;
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isPreview =
      host.includes("lovable.app") ||
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".lovableproject.com");
    origin = isPreview ? PRODUCTION_ORIGIN : window.location.origin;
  }
  if (shortCode && shortCode.trim()) {
    return `${origin}/e/${shortCode.trim()}`;
  }
  return `${origin}/events/${eventId}`;
}
