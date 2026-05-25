## Diagnosis

Sameera's `profiles.role` is still `admin`, but her row is **missing from the `user_roles` table**. All other admins (Hashim, Islam, Aqil, Shehla) have a matching `user_roles` row with `role = 'admin'`; Sameera does not.

Every admin-gated query and RLS policy in the app uses `has_role(auth.uid(), 'admin')`, which reads from `user_roles` — not `profiles.role`. With no row there, she is treated as a non-admin: counts return 0, admin tabs hide, etc. Re-login won't help because the data is missing server-side.

Editing dependents almost certainly did not cause this; it just happened to be when she noticed. Her `user_roles` row was likely never created (or was deleted) at some earlier point.

## Fix

Insert the missing row:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('f476aba5-e615-4018-a20b-5ab1e4fd2157', 'admin');
```

After this, she should refresh once and her admin dashboard will return to normal. No code changes are needed.

## Optional follow-up (not in this change)

We can later add a safeguard so any profile with `role = 'admin'` automatically has a matching `user_roles` row (trigger or a one-time reconciliation query), to prevent this drift from recurring. Let me know if you want that included.
