## Fix: "Create Family Group" RLS error

### Root cause
The current flow makes two separate client-side calls under user RLS:
1. `INSERT INTO families` — gated by a policy that runs a subquery against `profiles` (`NOT EXISTS … profiles where id = auth.uid() AND family_id IS NOT NULL`).
2. `UPDATE profiles SET family_id = …`.

The INSERT policy's subquery is brittle: it depends on `profiles` SELECT RLS, on `auth.uid()` being readable, and on there being exactly one matching profile row. For this user the `families` row never gets created and the family link never lands, producing the visible "new row violates row-level security policy for table families" toast. The two-step approach is also non-atomic — if step 2 fails, an orphan family is left behind and the user is "stuck in a family group" they can't see.

### Fix — atomic SECURITY DEFINER RPC

Replace both client steps with one server-side function that runs as the table owner (bypasses RLS) but enforces the rules itself.

**Migration:**
- Create `public.create_my_family(p_name text) RETURNS families` — `SECURITY DEFINER`, `SET search_path = public`.
  - Raises if `auth.uid() IS NULL`.
  - Raises a friendly `EXCEPTION` if caller's profile already has `family_id` set.
  - Inserts a row into `families` and updates `profiles.family_id` for `auth.uid()` in the same transaction.
  - Returns the new family row.
- `GRANT EXECUTE ON FUNCTION public.create_my_family(text) TO authenticated;`
- Tighten the families INSERT policy so direct client inserts are no longer needed (drop "Authenticated users can create families"; admins keep their `FOR ALL` policy).

**Client change — `src/components/profile/FamilyInviteSection.tsx`:**
- Replace the body of `handleCreateFamily` with a single `supabase.rpc("create_my_family", { p_name: familyLabel })` call.
- Keep the existing "already in a family" friendly toast by mapping the function's known error code/message.
- Remove the manual rollback block (no longer needed — atomic).

### Out of scope
- No changes to UPDATE/DELETE/SELECT policies on `families`.
- No change to invite, leave, or rename flows.
- No schema changes to `families` or `profiles`.

### Verification
- As an authenticated user with `family_id = NULL`, clicking "Create Family Group" succeeds and the user is linked.
- A second click shows the friendly "already in a family group" message instead of an RLS error.
- Direct client `INSERT INTO families` from a non-admin is rejected (defense in depth).
