export interface Coords {
  lat: number;
  lng: number;
}

function valid(lat: number, lng: number): Coords | null {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

const PATTERNS: RegExp[] = [
  // /@lat,lng[,zoom]
  /[/@](-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)(?:,[\d.]+z?)?/i,
  // !3dlat!4dlng (embed / place)
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
  // ?q=lat,lng / &q=lat,lng / &query=lat,lng / &ll=lat,lng / &destination=lat,lng / &center=lat,lng
  /[?&](?:q|query|ll|destination|center|sll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i,
];

/**
 * Best-effort extraction of latitude/longitude from a Google Maps URL.
 * Returns null for empty input, short links (goo.gl/maps, maps.app.goo.gl),
 * or any malformed/out-of-bounds value. Never throws.
 */
export function parseGoogleMapsCoords(url: string | null | undefined): Coords | null {
  try {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;

    for (const re of PATTERNS) {
      const m = trimmed.match(re);
      if (m) {
        const lat = parseFloat(m[1]);
        const lng = parseFloat(m[2]);
        const result = valid(lat, lng);
        if (result) return result;
      }
    }
    return null;
  } catch {
    return null;
  }
}
