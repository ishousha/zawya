/**
 * Caches ticket data (RSVP + Event) in localStorage so the QR ticket
 * screen can render fully offline.
 */

import type { Database } from "@/integrations/supabase/types";

type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];
type Event = Database["public"]["Tables"]["events"]["Row"];

interface CachedTicket {
  rsvp: RSVP;
  event: Event;
  profileName: string;
  cachedAt: string;
}

const STORAGE_KEY = "zawya-offline-tickets";

function readAll(): Record<string, CachedTicket> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function writeAll(tickets: Record<string, CachedTicket>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
}

/** Save or update a ticket in the offline cache. Keyed by rsvp.id */
export function cacheTicket(rsvp: RSVP, event: Event, profileName: string) {
  const all = readAll();
  all[rsvp.id] = { rsvp, event, profileName, cachedAt: new Date().toISOString() };
  writeAll(all);
}

/** Get a cached ticket by event ID (for the current user's RSVP) */
export function getCachedTicketByEvent(eventId: string): CachedTicket | null {
  const all = readAll();
  const match = Object.values(all).find((t) => t.event.id === eventId);
  return match ?? null;
}

/** Remove a cached ticket (e.g. when RSVP is cancelled) */
export function removeCachedTicket(rsvpId: string) {
  const all = readAll();
  delete all[rsvpId];
  writeAll(all);
}

/** Get all cached tickets */
export function getAllCachedTickets(): CachedTicket[] {
  return Object.values(readAll());
}

/** Clean up tickets for past events (older than 24h after event time) */
export function cleanExpiredTickets() {
  const all = readAll();
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  let changed = false;
  for (const [id, ticket] of Object.entries(all)) {
    const eventTime = new Date(ticket.event.date_time).getTime();
    if (eventTime < cutoff) {
      delete all[id];
      changed = true;
    }
  }
  if (changed) writeAll(all);
}

// --- Sign-up item selections per RSVP (so the ticket can show "Bringing" offline) ---

export interface CachedSignUpItem {
  itemName: string;
  quantity: number;
  description?: string | null;
}

const SIGNUP_STORAGE_KEY = "zawya-offline-ticket-signups";

function readAllSignUps(): Record<string, CachedSignUpItem[]> {
  try {
    const raw = localStorage.getItem(SIGNUP_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function cacheRsvpSignUpItems(rsvpId: string, items: CachedSignUpItem[]) {
  const all = readAllSignUps();
  all[rsvpId] = items;
  try {
    localStorage.setItem(SIGNUP_STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

export function getCachedRsvpSignUpItems(rsvpId: string): CachedSignUpItem[] | null {
  const all = readAllSignUps();
  return all[rsvpId] ?? null;
}
