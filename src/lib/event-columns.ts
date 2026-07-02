/**
 * Safe column list for the `events` table — excludes sensitive fields
 * (zoom_password, recording_passcode, checkin_pin) that must only be
 * fetched via gated RPCs (see get_event_zoom_credentials, get_event_admin_secrets).
 */
export const EVENT_PUBLIC_COLUMNS =
  "id, short_code, title, date_time, end_date_time, location, address, maps_url, status, cover_photo_url, event_type_id, capacity, has_potluck, virtual_link, zoom_link, online_link, is_hybrid, host_id, description, venue_id, ticket_fee, mureeds_only, allow_guests, age_group, age_groups, audience_gender, location_hint, etiquette_notes, payment_instructions, waitlist_capacity, published, scheduled_publish_at, last_published_at, recording_url, cancelled_at, created_at, updated_at";
