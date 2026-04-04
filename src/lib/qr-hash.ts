/**
 * Generates a secure hash for QR code verification.
 * Uses Web Crypto API to create a SHA-256 hash of the RSVP ID + timestamp.
 */
export async function generateQRHash(rsvpId: string): Promise<string> {
  const timestamp = Date.now().toString();
  const data = `${rsvpId}:${timestamp}`;
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hashHex.slice(0, 16)}-${timestamp}`;
}
