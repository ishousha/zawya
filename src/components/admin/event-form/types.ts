export function generateCheckinPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Suggest a vanity short code from event title + start datetime.
 * Format: capitalized first letters of first two words + DDMM.
 *   "Thursday Gathering" + 2026-05-14 → "TG1405"
 * Returns "" if title or date are missing/unusable.
 */
export function suggestShortCode(title: string, dateTime: string): string {
  if (!title?.trim() || !dateTime) return "";
  const words = title
    .trim()
    .split(/\s+/)
    .map((w) => w.replace(/[^A-Za-z]/g, ""))
    .filter(Boolean);
  let letters = "";
  if (words.length >= 2) {
    letters = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1) {
    letters = words[0].slice(0, 2).toUpperCase();
  }
  if (!letters) return "";
  const d = new Date(dateTime);
  if (isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${letters}${dd}${mm}`;
}

export const AGE_GROUP_OPTIONS = [
  "All Ages",
  "Kids (Under 12)",
  "Youth (13-18)",
  "Young Adults (18-30)",
  "Adults (18+)",
] as const;

export const AUDIENCE_GENDER_OPTIONS = [
  "Everyone",
  "Brothers Only",
  "Sisters Only",
] as const;

export type AudienceGender = typeof AUDIENCE_GENDER_OPTIONS[number];

export interface EventFormState {
  title: string;
  description: string;
  date_time: string;
  end_date_time: string;
  event_type_id: string;
  venue_id: string | null;
  location: string;
  address: string;
  maps_url: string;
  virtual_link: string;
  cover_photo_url: string | null;
  capacity: string;
  waitlist_capacity: string;
  is_hybrid: boolean;
  has_potluck: boolean;
  ticket_fee: string;
  payment_instructions: string;
  online_link: string;
  status: "active" | "full" | "cancelled";
  checkin_pin: string;
  host_id: string | null;
  mureeds_only: boolean;
  speaker_ids: string[];
  notify_members: boolean;
  notify_attendees: boolean;
  etiquette_notes: string;
  location_hint: string;
  age_group: string;
  age_groups: string[];
  audience_gender: AudienceGender;
  published: boolean;
  scheduled_publish_at: string;
  enable_virtual: boolean;
  zoom_password: string;
  recording_url: string;
  recording_passcode: string;
  short_code: string;
}

export interface SignUpItemState {
  id?: number;
  item_name: string;
  quantity_limit: number;
  order_index: number;
}

export const defaultEventForm: EventFormState = {
  title: "",
  description: "",
  date_time: "",
  end_date_time: "",
  event_type_id: "",
  venue_id: null,
  location: "",
  address: "",
  maps_url: "",
  virtual_link: "",
  cover_photo_url: "https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/Event_Cover_27r1gi27r1gi27r1.webp",
  capacity: "",
  waitlist_capacity: "0",
  is_hybrid: false,
  has_potluck: true,
  ticket_fee: "0",
  payment_instructions: "",
  online_link: "",
  status: "active",
  checkin_pin: generateCheckinPin(),
  host_id: null,
  mureeds_only: false,
  speaker_ids: [],
  notify_members: false,
  notify_attendees: false,
  etiquette_notes: "",
  location_hint: "",
  age_group: "All Ages",
  age_groups: ["All Ages"],
  audience_gender: "Everyone",
  published: false,
  scheduled_publish_at: "",
  enable_virtual: false,
  zoom_password: "",
  recording_url: "",
  recording_passcode: "",
  short_code: "",
};

// Keep EventType as a legacy re-export alias — no longer used
export type EventType = string;
