---
name: DB Schema
description: profiles, events (with cover_photo, hybrid, waitlist, ticket_fee, venue_id), user_roles, rsvps (with attending_dependents JSONB), event_sign_up_items, guest_requests, dependents, venues tables
type: feature
---
- profiles: id, name, email, phone, family_name, role (app_role enum), whatsapp_number, alternate_cell_number, date_of_birth, timestamps
- events: id, title, description, type (event_type), date_time, end_date_time, location, address, zoom_link, virtual_link, cover_photo_url, capacity, waitlist_capacity, is_hybrid, has_potluck, ticket_fee (numeric), venue_id (fk venues), status (event_status), timestamps
- venues: id, name, address, created_at
- user_roles: id, user_id, role (app_role) — separate from profiles for security
- rsvps: id, event_id, user_id, guests_count, attending_dependents (jsonb - [{name, age}]), potluck_category, specific_food_item, checked_in, is_waitlisted, qr_hash, timestamps
- event_sign_up_items: id (bigint), event_id, item_name, quantity_limit (0=unlimited), order_index, created_at
- rsvp_sign_up_selections: id (bigint), rsvp_id, sign_up_item_id, quantity, created_at
- dependents: id, parent_id (fk profiles), first_name, date_of_birth, created_at
- guest_requests: id, event_id, requesting_user_id, guest_name, guest_phone, status (guest_request_status), timestamps
- Enums: app_role (admin/approved/pending), event_status (active/full/cancelled), event_type (gathering/class/trip/retreat/meeting), guest_request_status, potluck_category
- Storage bucket: event-covers (public read, admin write)
