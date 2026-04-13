
-- Indexes for admin dashboard performance

-- Fast user filtering by role (UserManagement tab)
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles (role);

-- Fast event listing sorted by date (EventControlRoom tab)
CREATE INDEX IF NOT EXISTS idx_events_date_time ON public.events (date_time DESC);

-- Fast published event filtering
CREATE INDEX IF NOT EXISTS idx_events_published ON public.events (published) WHERE published = true;

-- Fast RSVP lookups per event (event cards, check-in)
CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON public.rsvps (event_id);

-- Fast RSVP lookups per user
CREATE INDEX IF NOT EXISTS idx_rsvps_user_id ON public.rsvps (user_id);

-- Fast guest request filtering by status (AllGuestApprovals tab)
CREATE INDEX IF NOT EXISTS idx_guest_requests_status ON public.guest_requests (status);

-- Fast notification badge count
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id) WHERE is_read = false;

-- Fast activity log pagination (AdminActivityLog tab)
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.admin_activity_log (created_at DESC);

-- Fast user_roles lookup (used by has_role function on every RLS check)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles (user_id, role);

-- Fast family member lookups
CREATE INDEX IF NOT EXISTS idx_profiles_family_id ON public.profiles (family_id) WHERE family_id IS NOT NULL;

-- Fast event type lookups
CREATE INDEX IF NOT EXISTS idx_events_event_type_id ON public.events (event_type_id);

-- Fast event speaker lookups
CREATE INDEX IF NOT EXISTS idx_event_speakers_event_id ON public.event_speakers (event_id);
