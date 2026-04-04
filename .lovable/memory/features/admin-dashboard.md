---
name: Admin Dashboard
description: Admin dashboard with user management, event control, and QR door scanner
type: feature
---
- Route: /admin (admin-only, guarded in component + shown in BottomNav for admins)
- 3 tabs: User Management, Event Control Room, Live Door Scanner
- UserManagement: approve/reject users, manage guest requests, pending float to top
- EventControlRoom: create/edit events, set capacity + potluck limits, RSVP monitor
- AdminDoorScanner: @yudiel/react-qr-scanner, validates qr_hash, marks checked_in, success/error audio tones
- guest_requests table with guest_request_status enum (pending/approved/rejected)
