## Plan

1. **Confirm Sameera’s account state**
   - Sameera’s profile is present, completed onboarding, and has `admin` in both profile and backend role records.
   - The hosted backend is healthy and the live data is not zero, so this looks like a client/session/cache issue rather than missing admin access data.

2. **Fix the stale dashboard/cache problem**
   - Update the app so signing out clears in-memory query data and admin dashboard query caches.
   - Ensure profile saves trigger a fresh profile/dashboard refresh when returning home.
   - Add basic query error visibility so admin dashboard cards don’t silently show zeros if a protected query fails.

3. **Immediate restore guidance for Sameera**
   - After the fix is published, ask Sameera to use the in-app “Refresh app” option on Profile once, or fully close/reopen the PWA, so the installed app loads the latest version.

4. **Validation**
   - Verify Sameera’s backend role remains `admin`.
   - Verify the dashboard counts come from live backend data: upcoming events, member count, families, RSVPs, and dependents are non-zero.

## Technical details

- No database role repair is needed for Sameera: her `profiles.role` and `user_roles.role` are both `admin`.
- The symptom “dashboard full of zeros” matches cached/stale client query state or failed protected queries being hidden by default values.
- Implementation will focus on `AuthContext`, `Profile`, and dashboard summary/analytics query handling; no schema migration is required.