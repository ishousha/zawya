## Bulk member actions in Admin → Users

The Users tab already supports selecting multiple members and currently exposes only **Delete Selected**, **Mark as Mureed**, and **Unmark Mureed**. Extend the existing bulk toolbar with the full set of status changes admins do one-by-one today.

### New bulk actions
Added to the "X selected" toolbar's dropdown menu:

1. **Approve** → set role to `approved` (works for `pending` and `suspended` rows; reinstated rows use the `user-reinstated` email template, otherwise `user-approved`).
2. **Reject** → set role to `rejected` (sends `user-rejected` email).
3. **Suspend** → set role to `suspended` (sends `user-suspended` email).
4. **Reinstate** → shortcut for suspended → `approved` (same as Approve but only enabled when the selection contains suspended users).
5. **Convert to Guest** → set role to `guest`.
6. **Convert to Member (Approved)** → set role to `approved` (for promoting guests).
7. **Mark as Mureed** / **Unmark Mureed** — already present, keep.
8. **Delete Selected** — already present, keep.

### Behavior
- Each action runs sequentially per-selected-id reusing the existing single-user mutation logic: update `profiles.role`, sync `user_roles`, call `notifyUserApproval`, and trigger the matching transactional email (same template map already in `updateUserRole`). Failures per row are caught so one bad row doesn't halt the batch; a summary toast reports `N succeeded, M failed`.
- Destructive / high-impact actions (Reject, Suspend, Delete) show an `AlertDialog` confirmation listing the count before running.
- Skip rows where the new role equals the current role (no-op).
- After completion: invalidate `admin-profiles`, `admin-user-roles`, clear the selection, log one `bulk_role_change` entry per row via the existing `logActivity` helper.

### Implementation outline
- Add a `bulkUpdateRole` mutation in `src/components/admin/UserManagement.tsx` that takes `{ ids, role }` and iterates with `Promise.allSettled`, reusing the body of `updateUserRole.mutationFn` (extract into a shared helper `applyRoleChange(profile, role)` to avoid duplication).
- Extend the `DropdownMenu` inside the bulk toolbar (around line 502–520) with the new items, each wired to either `bulkUpdateRole.mutate(...)` directly or via a confirmation `AlertDialog` for destructive ones.
- Disable bulk-action buttons while any bulk mutation `isPending`.
- No DB / schema changes required.

### Files touched
- `src/components/admin/UserManagement.tsx` (only file).

### Verification
- Select a mix of pending + approved users → Approve: approved stays, pending becomes approved, toast confirms count.
- Select approved users → Suspend → confirmation → all become suspended.
- Select suspended → Reinstate → all become approved (reinstated email template).
- Select members → Delete (existing) still works.
- Try a bulk action that includes an already-matching role → toast shows "skipped N no-ops".
