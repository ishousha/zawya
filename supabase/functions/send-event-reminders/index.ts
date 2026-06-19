import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // --- Auth: internal (cron / service role) or admin only ---
  const authHeader = req.headers.get('Authorization') ?? ''
  const internalSecret = req.headers.get('x-internal-secret')
  const isInternal = !!supabaseServiceKey && internalSecret === supabaseServiceKey
  if (!isInternal) {
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    if (token !== supabaseServiceKey) {
      const anon = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: claims } = await anon.auth.getClaims(token)
      const callerId = claims?.claims?.sub
      if (!callerId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: isAdmin } = await anon.rpc('has_role', {
        _user_id: callerId,
        _role: 'admin',
      })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  const now = new Date()
  let totalSent = 0

  // Check for events starting in ~24 hours and ~2 hours
  const windows = [
    { type: '24h' as const, hoursAhead: 24, bufferMinutes: 10 },
    { type: '12h' as const, hoursAhead: 12, bufferMinutes: 10 },
    { type: '2h' as const, hoursAhead: 2, bufferMinutes: 10 },
  ]

  for (const w of windows) {
    const windowStart = new Date(now.getTime() + w.hoursAhead * 60 * 60 * 1000)
    const windowEnd = new Date(windowStart.getTime() + w.bufferMinutes * 60 * 1000)

    // Find active/full events in this window
    const { data: events } = await supabase
      .from('events')
      .select('id, title, date_time, location, address, host_id, status')
      .in('status', ['active', 'full'])
      .gte('date_time', windowStart.toISOString())
      .lte('date_time', windowEnd.toISOString())

    if (!events || events.length === 0) continue

    for (const event of events) {
      // Check if reminder already sent for this window
      const { data: existing } = await supabase
        .from('event_reminders_sent')
        .select('id')
        .eq('event_id', event.id)
        .eq('reminder_type', w.type)
        .limit(1)

      if (existing && existing.length > 0) {
        console.log(`Already sent ${w.type} reminder for event ${event.id}`)
        continue
      }

      // Fetch all confirmed (non-waitlisted) RSVPs
      const { data: rsvps } = await supabase
        .from('rsvps')
        .select('id, user_id, potluck_category, specific_food_item')
        .eq('event_id', event.id)
        .eq('is_waitlisted', false)

      if (!rsvps || rsvps.length === 0) continue

      const userIds = [...new Set(rsvps.map((r: any) => r.user_id))]
      const rsvpIds = rsvps.map((r: any) => r.id)

      const [{ data: profiles }, { data: selections }] = await Promise.all([
        supabase.from('profiles').select('id, name, email').in('id', userIds),
        supabase
          .from('rsvp_sign_up_selections')
          .select('rsvp_id, quantity, description, event_sign_up_items(item_name)')
          .in('rsvp_id', rsvpIds),
      ])

      // Group sign-up selections by user_id (via rsvp_id)
      const rsvpById = new Map<string, any>(rsvps.map((r: any) => [r.id, r]))
      const itemsByUser = new Map<string, any[]>()
      for (const sel of selections ?? []) {
        const rsvp = rsvpById.get((sel as any).rsvp_id)
        if (!rsvp) continue
        const list = itemsByUser.get(rsvp.user_id) ?? []
        list.push({
          itemName: (sel as any).event_sign_up_items?.item_name ?? 'Item',
          quantity: (sel as any).quantity ?? 1,
          description: (sel as any).description ?? null,
        })
        itemsByUser.set(rsvp.user_id, list)
      }

      // Legacy single potluck item per user (oldest events)
      const legacyByUser = new Map<string, string>()
      for (const r of rsvps as any[]) {
        const legacy = r.specific_food_item || r.potluck_category
        if (legacy && !legacyByUser.has(r.user_id)) legacyByUser.set(r.user_id, legacy)
      }

      const eventDate = new Date(event.date_time).toLocaleString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
        hour: 'numeric', minute: '2-digit',
      })
      const eventLocation = event.location
        ? `${event.location}${event.address ? ` — ${event.address}` : ''}`
        : ''

      for (const profile of profiles ?? []) {
        if (!profile.email) continue

        const userItems = itemsByUser.get(profile.id) ?? []
        const legacyItem = legacyByUser.get(profile.id)

        try {
          await supabase.functions.invoke('send-transactional-email', {
            body: {
              templateName: 'event-reminder',
              recipientEmail: profile.email,
              idempotencyKey: `event-reminder-${event.id}-${profile.id}-${w.type}`,
              templateData: {
                memberName: profile.name || undefined,
                eventTitle: event.title,
                eventDate,
                eventLocation,
                reminderType: w.type,
                signUpItems: userItems,
                potluckItem: userItems.length === 0 ? legacyItem : undefined,
              },
            },
          })
          totalSent++
          console.log(`Sent ${w.type} reminder to ${profile.email} for ${event.title}`)
        } catch (e) {
          console.error(`Failed to send ${w.type} reminder to ${profile.email}:`, e)
        }
      }

      // Record that we sent this reminder
      await supabase.from('event_reminders_sent').insert({
        event_id: event.id,
        reminder_type: w.type,
      })
    }
  }

  console.log(`Event reminders complete: ${totalSent} emails sent`)
  return new Response(JSON.stringify({ sent: totalSent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
