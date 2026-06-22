/**
 * Canonical shareable deep link for a library resource.
 * Prefers `/r/<shortCode>` when available; falls back to `/library/<uuid>`.
 * In preview/localhost falls back to the production origin so recipients land
 * on a working URL.
 */
const PRODUCTION_ORIGIN = "https://zawya.app";

export function getResourceShareUrl(resourceId: string, shortCode?: string | null): string {
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
    return `${origin}/r/${shortCode.trim()}`;
  }
  return `${origin}/library/${resourceId}`;
}
