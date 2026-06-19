## Plan

1. **Update host search filtering**
   - Change the host selector query to only return eligible member/admin profiles instead of every profile.
   - Exclude rejected, pending, suspended, and guest-only accounts from the host dropdown so email-only rejected records do not appear.

2. **Prefer member names in the dropdown**
   - Keep the primary label as the profile `name`.
   - If a profile has no name, show a clear fallback like `Unnamed member` instead of making the email look like the member name.
   - Keep email as secondary text only for disambiguation when a name exists.

3. **Keep debounced search behavior**
   - Preserve the existing 350ms debounced search so backend queries are reduced while typing.
   - Continue searching by name, email, and family name so admins can still find members quickly.

4. **Verify in the venue dialog**
   - Confirm the Add/Edit Venue host selector opens inside the dialog.
   - Confirm typing filters after debounce.
   - Confirm results show member names as the main text and selecting one updates the host field.

## Technical details

- File to update: `src/components/admin/event-form/HostSelector.tsx`.
- Query change: add role filtering, likely `role in ('approved','admin','moderator')`, while preserving `.or(...)` search conditions.
- Display change: replace primary `{p.name || p.email}` with a name-first label helper and render email as secondary metadata rather than the main option label.