## Root Causes

**1. "Send guest list" — emails never delivered**
`send-guest-list-reminder` returns `{ sent: 6 }` and the client toasts success, but every inner call to `send-transactional-email` fails with **HTTP 401** (confirmed via edge logs at 19:40). Cause: `send-transactional-email` validates the caller with `supabase.auth.getClaims(token)`, which rejects the **service-role** JWT that `supabase.functions.invoke()` automatically attaches when called from inside another edge function. Result: every send 401s, the failure is swallowed by the `try/catch` inside the loop, and `email_send_log` never receives a row.

**2. "Preview" button — shows "Nothing to preview"**
The client (`EventRsvpDetail.handlePreviewGuestList`) calls `send-guest-list-reminder` with `{ event_id, preview: true }` and expects `{ html, subject, recipients, summary }` back. But the edge function **has no preview branch** — it ignores `preview`, actually sends the emails, and returns `{ sent: N }`. So the dialog never opens AND every preview click silently fires real (failing) sends.

## Fix

### A. `supabase/functions/send-transactional-email/index.ts`
Allow service-role callers to bypass `getClaims()`:
- After reading the `Authorization` header, if `token === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, skip the `getClaims` check and proceed (this is exactly the case for server-to-server invocations from other edge functions / DB triggers).
- Otherwise keep current `getClaims` validation for end-user calls.

### B. `supabase/functions/send-guest-list-reminder/index.ts`
Add a `preview` mode:
- Parse `body.preview === true` alongside `event_id`.
- When `preview` is true: build the same `templateData`, render the `guest-list-reminder` template via `renderAsync(React.createElement(template.component, templateData))` (import from `../_shared/transactional-email-templates/registry.ts`), resolve `template.subject`, collect recipient emails (host + admins + moderators) but **do NOT enqueue or send anything** and **do NOT insert into `guest_list_reminders_sent`**.
- Return `{ preview: true, subject, html, recipients, summary: { totalHeadcount, totalAdults, totalElders, totalChildren, guestCount: guestList.length } }`.
- Existing non-preview path is unchanged.

### C. Redeploy both functions (auto-deploy on save).

## Verification
1. Click **Preview** on Thursday Gathering admin → preview dialog opens with rendered HTML; no rows added to `guest_list_reminders_sent`; no rows added to `email_send_log`.
2. Click **Send guest list** → toast success; `email_send_log` shows ~6 new `pending → sent` rows for `guest-list-reminder`; recipients (host + admins + moderators) actually receive the email.
3. Edge logs for `send-transactional-email` show `200`, no more `401`.

## Notes
- No DB schema or RLS changes needed.
- No client changes needed — `EventRsvpDetail` already sends `preview: true` and consumes `{ html, subject, recipients, summary }`.
- Other server-to-server callers of `send-transactional-email` (e.g. `promote_waitlisted_on_cancel` DB trigger using service-role bearer, `send-event-reminders`, `send-event-broadcast`, `notify-guest-rejected`) will also start working if they were silently 401-ing.
