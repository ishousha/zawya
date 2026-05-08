/**
 * Returns a canonical, shareable deep link for an event.
 * When called from inside the Lovable preview iframe or localhost, falls back
 * to the production origin so recipients land on a working URL.
 */
const PRODUCTION_ORIGIN = "https://zawya.app";

export function getEventShareUrl(eventId: string): string {
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
  return `${origin}/events/${eventId}`;
}
