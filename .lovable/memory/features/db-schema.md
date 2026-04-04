---
name: DB Schema
description: profiles, events (with cover_photo, hybrid, waitlist), user_roles, rsvps, event_sign_up_items, guest_requests tables
type: feature
---
- profiles: id, name, email, phone, family_name, role (app_role enum), timestamps
- events: id, title, type (event_type), date_time, end_date_time, location, zoom_link, virtual_link, cover_photo_url, capacity, waitlist_capacity, is_hybrid, status (event_status), timestamps
- user_roles: id, user_id, role (app_role) — separate from profiles for security
- rsvps: id, event_id, user_id, guests_count, potluck_category, specific_food_item, checked_in, qr_hash, timestamps
- event_sign_up_items: id (bigint), event_id, item_name, quantity_limit (0=unlimited), created_at — replaces potluck_config
- potluck_config: id, event_id, category (potluck_category), max_slots — legacy, replaced by event_sign_up_items
- guest_requests: id, event_id, requesting_user_id, guest_name, guest_phone, status (guest_request_status), timestamps
- Enums: app_role, event_status, event_type, guest_request_status, potluck_category
- Storage bucket: event-covers (public read, admin write)
