import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface GuestEntry {
  name: string
  family?: string
  adults: number
  children: number
  elders: number
}

interface PotluckItem {
  dish: string
  family: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // --- Auth: internal (cron / service role) or admin/moderator only ---
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
      const [{ data: isAdmin }, { data: isMod }] = await Promise.all([
        anon.rpc('has_role', { _user_id: callerId, _role: 'admin' }),
        anon.rpc('has_role', { _user_id: callerId, _role: 'moderator' }),
      ])
      if (!isAdmin && !isMod) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Determine mode: auto (cron), manual, or preview
  let mode: 'auto' | 'manual' = 'auto'
  let targetEventId: string | null = null
  let preview = false

  if (req.method === 'POST') {
    try {
      const body = await req.json()
      if (body.event_id) {
        mode = 'manual'
        targetEventId = body.event_id
      }
      if (body.preview === true) {
        preview = true
      }
    } catch {
      // No body = auto mode (cron trigger)
    }
  }

  console.log(`Guest list reminder: mode=${mode}, preview=${preview}, targetEventId=${targetEventId}`)

  // Find events to send reminders for
  let events: any[] = []

  if (mode === 'manual' && targetEventId) {
    const { data } = await supabase
      .from('events')
      .select('id, title, date_time, location, address, host_id, status')
      .eq('id', targetEventId)
      .in('status', ['active', 'full'])
      .single()
    if (data) events = [data]
  } else {
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const buffer = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 10 * 60 * 1000)

    const { data } = await supabase
      .from('events')
      .select('id, title, date_time, location, address, host_id, status')
      .in('status', ['active', 'full'])
      .gte('date_time', twoHoursLater.toISOString())
      .lte('date_time', buffer.toISOString())

    events = data ?? []
  }

  if (events.length === 0) {
    console.log('No events to send reminders for')
    if (preview) {
      return new Response(JSON.stringify({ error: 'Event not found or not active' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let totalSent = 0

  for (const event of events) {
    if (mode === 'auto' && !preview) {
      const { data: existing } = await supabase
        .from('guest_list_reminders_sent')
        .select('id')
        .eq('event_id', event.id)
        .eq('trigger_type', 'auto')
        .limit(1)
      if (existing && existing.length > 0) {
        console.log(`Already sent auto reminder for event ${event.id}`)
        continue
      }
    }

    const { data: rsvps } = await supabase
      .from('rsvps')
      .select('*')
      .eq('event_id', event.id)
    if (!rsvps || rsvps.length === 0) {
      if (preview) {
        return new Response(JSON.stringify({ error: 'No RSVPs yet for this event' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      continue
    }

    const userIds = [...new Set(rsvps.map((r: any) => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, family_name')
      .in('id', userIds)
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    let totalRegularAdults = 0
    let totalElders = 0
    let totalChildren = 0

    const guestList: GuestEntry[] = []
    const potluckItems: PotluckItem[] = []

    for (const r of rsvps) {
      const profile = profileMap.get(r.user_id)
      const deps: any[] = (r.attending_dependents as any[]) || []
      const childDeps = deps.filter((d: any) => d.type === 'dependent' && d.dependent_type !== 'elder')
      const elderDeps = deps.filter((d: any) => d.type === 'dependent' && d.dependent_type === 'elder')

      const adults = r.guests_count - childDeps.length - elderDeps.length + elderDeps.length
      totalRegularAdults += r.guests_count - childDeps.length - elderDeps.length
      totalElders += elderDeps.length
      totalChildren += childDeps.length

      guestList.push({
        name: profile?.name || 'Unknown',
        family: profile?.family_name || undefined,
        adults,
        children: childDeps.length,
        elders: elderDeps.length,
      })

      if (r.specific_food_item?.trim()) {
        potluckItems.push({
          dish: r.specific_food_item,
          family: profile?.family_name || profile?.name || 'Unknown',
        })
      }
    }

    const totalAdults = totalRegularAdults + totalElders
    const totalHeadcount = totalAdults + totalChildren

    const eventDate = new Date(event.date_time).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
    const eventLocation = event.location
      ? `${event.location}${event.address ? ` — ${event.address}` : ''}`
      : ''

    const templateData = {
      eventTitle: event.title,
      eventDate,
      eventLocation,
      totalHeadcount,
      totalAdults,
      totalElders,
      totalChildren,
      guestList,
      potluckItems,
    }

    // Collect recipients: host + admins + moderators
    const recipientIds = new Set<string>()
    if (event.host_id) recipientIds.add(event.host_id)

    const { data: adminRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'moderator'])
    for (const r of adminRoles ?? []) {
      recipientIds.add(r.user_id)
    }

    const { data: recipientProfiles } = await supabase
      .from('profiles')
      .select('id, name, email')
      .in('id', Array.from(recipientIds))

    if (preview) {
      const tpl = TEMPLATES['guest-list-reminder']
      if (!tpl) {
        return new Response(JSON.stringify({ error: 'Template guest-list-reminder not registered' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const html = await renderAsync(React.createElement(tpl.component, templateData))
      const subject =
        typeof tpl.subject === 'function' ? tpl.subject(templateData) : tpl.subject
      const recipients = (recipientProfiles ?? [])
        .filter((p: any) => p.email)
        .map((p: any) => ({ name: p.name, email: p.email }))

      return new Response(
        JSON.stringify({
          preview: true,
          subject,
          html,
          recipients,
          summary: {
            totalHeadcount,
            totalAdults,
            totalElders,
            totalChildren,
            guestCount: guestList.length,
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    for (const recipient of recipientProfiles ?? []) {
      if (!recipient.email) continue

      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Hardcoded anon JWT — required by the gateway. SUPABASE_ANON_KEY env
            // returns the new sb_publishable_ format which the gateway rejects.
            Authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlremFhbHN3a2FqdGF4ZWp5c2t3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyOTMxMzksImV4cCI6MjA5MDg2OTEzOX0.l6J3gnjuaBXgIMjDgffn6T5N9hJAVkcB4PCoVO3WZWg',
            'x-internal-secret': supabaseServiceKey,
          },
          body: JSON.stringify({
            templateName: 'guest-list-reminder',
            recipientEmail: recipient.email,
            idempotencyKey: `guest-list-${event.id}-${recipient.id}-${mode}-${Date.now()}`,
            templateData: {
              ...templateData,
              recipientName: recipient.name || undefined,
            },
          }),
        })
        if (!resp.ok) {
          const txt = await resp.text()
          console.error(`send-transactional-email ${resp.status} for ${recipient.email}: ${txt}`)
        } else {
          totalSent++
          console.log(`Sent guest list to ${recipient.email} for event ${event.title}`)
        }
      } catch (e) {
        console.error(`Failed to send guest list to ${recipient.email}:`, e)
      }
    }

    await supabase.from('guest_list_reminders_sent').insert({
      event_id: event.id,
      trigger_type: mode,
    })
  }

  console.log(`Guest list reminder complete: ${totalSent} emails sent`)
  return new Response(JSON.stringify({ sent: totalSent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
