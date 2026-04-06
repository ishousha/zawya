---
name: DB Schema
description: profiles (with family_id), events (with event_type_id FK), event_types, user_roles, rsvps, families, potluck_config, venues tables
type: feature
---
- families: id, name, created_at
- profiles: id, name, email, phone, family_name, family_id (fk families), role (app_role enum), whatsapp_number, alternate_cell_number, date_of_birth, terms_accepted, timestamps
- event_types: id, name, icon, requires_location (bool), is_virtual (bool), allows_potluck (bool), created_at — dynamic, admin-managed
- events: id, title, description, event_type_id (fk event_types), date_time, end_date_time, location, address, zoom_link, virtual_link, online_link, cover_photo_url, capacity, waitlist_capacity, is_hybrid, has_potluck, ticket_fee (numeric), payment_instructions, venue_id (fk venues), status (event_status), timestamps
- venues: id, name, address, created_at
- user_roles: id, user_id, role (app_role) — separate from profiles for security
- rsvps: id, event_id, user_id, guests_count, attending_dependents (jsonb), potluck_category, specific_food_item, checked_in, is_waitlisted, qr_hash, timestamps
- event_sign_up_items: id (bigint), event_id, item_name, quantity_limit, order_index, created_at
- rsvp_sign_up_selections: id (bigint), rsvp_id, sign_up_item_id, quantity, created_at
- dependents: id, parent_id (fk profiles), first_name, date_of_birth, created_at
- guest_requests: id, event_id, requesting_user_id, guest_name, guest_email, guest_phone, status, timestamps
- Enums: app_role (admin/moderator/approved/guest/pending/suspended), event_status (active/full/cancelled), guest_request_status, potluck_category
- RLS: users can view profiles of family members sharing same family_id
- event_type enum REMOVED — replaced by event_types table
