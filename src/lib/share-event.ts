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

interface GuestWhatsAppInput {
  guestName: string;
  guestPhone?: string | null;
  eventTitle: string;
  eventDateISO?: string | null;
  location?: string | null;
  address?: string | null;
  mapsUrl?: string | null;
  onlineLink?: string | null;
}

/**
 * Builds a WhatsApp share URL pre-populated with event details for an
 * approved guest. If `guestPhone` is provided we open a direct chat with
 * the number, otherwise we open WhatsApp with just the message so the
 * host can pick a recipient.
 */
export function buildGuestWhatsAppUrl({
  guestName,
  guestPhone,
  eventTitle,
  eventDateISO,
  location,
  address,
  onlineLink,
}: GuestWhatsAppInput): string {
  let dateLine = "";
  if (eventDateISO) {
    try {
      const d = new Date(eventDateISO);
      dateLine = d.toLocaleString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      dateLine = "";
    }
  }
  const mapQuery = [location, address].filter(Boolean).join(", ");
  const mapUrl = mapQuery
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
    : "";

  const lines = [
    `Assalamu Alaikum ${guestName}! 🌙`,
    "",
    `You're warmly invited to *${eventTitle}*${dateLine ? ` on ${dateLine}` : ""}.`,
  ];
  if (location) lines.push("", `📍 ${location}`);
  if (address) lines.push(address);
  if (mapUrl) lines.push(`🗺 ${mapUrl}`);
  if (onlineLink) lines.push("", `🔗 Join online: ${onlineLink}`);
  lines.push("", "Looking forward to seeing you inshaAllah!");

  const message = lines.join("\n");
  const phone = (guestPhone || "").replace(/\D/g, "");
  return phone
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
}
