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
  infants: number
  children: number
  youth: number
  elders: number
}

interface PotluckItem {
  category: string
  dish: string
  family: string
  quantity: number
}

interface UnclaimedItem {
  name: string
  claimed: number
  limit: number
  remaining: number
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

  // App origin for building shareable check-in poster links inside the email.
  const APP_URL = 'https://zawya.app'

  // Find events to send reminders for. Each item also carries the trigger_type
  // that we'll persist in guest_list_reminders_sent ('5_hour' | '1_hour' | 'manual').
  type EventWithTrigger = { event: any; triggerType: '5_hour' | '1_hour' | 'manual' }
  let eventTasks: EventWithTrigger[] = []

  const selectCols = 'id, title, date_time, location, address, host_id, status, checkin_pin'

  if (mode === 'manual' && targetEventId) {
    const { data } = await supabase
      .from('events')
      .select(selectCols)
      .eq('id', targetEventId)
      .in('status', ['active', 'full'])
      .single()
    if (data) eventTasks = [{ event: data, triggerType: 'manual' }]
  } else {
    const now = new Date()
    const bufferMs = 10 * 60 * 1000 // 10-minute window aligned with cron cadence

    // 5-hour reminder window: events starting between now+5h and now+5h10m
    const fiveHrStart = new Date(now.getTime() + 5 * 60 * 60 * 1000)
    const fiveHrEnd = new Date(fiveHrStart.getTime() + bufferMs)

    // 1-hour reminder window: events starting between now+1h and now+1h10m
    const oneHrStart = new Date(now.getTime() + 1 * 60 * 60 * 1000)
    const oneHrEnd = new Date(oneHrStart.getTime() + bufferMs)

    const [{ data: fiveHr }, { data: oneHr }] = await Promise.all([
      supabase
        .from('events')
        .select(selectCols)
        .in('status', ['active', 'full'])
        .gte('date_time', fiveHrStart.toISOString())
        .lte('date_time', fiveHrEnd.toISOString()),
      supabase
        .from('events')
        .select(selectCols)
        .in('status', ['active', 'full'])
        .gte('date_time', oneHrStart.toISOString())
        .lte('date_time', oneHrEnd.toISOString()),
    ])

    for (const e of fiveHr ?? []) eventTasks.push({ event: e, triggerType: '5_hour' })
    for (const e of oneHr ?? []) eventTasks.push({ event: e, triggerType: '1_hour' })
  }

  if (eventTasks.length === 0) {
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

  for (const { event, triggerType } of eventTasks) {
    // Dedupe per (event, triggerType) so each window only fires once.
    if (!preview) {
      const { data: existing } = await supabase
        .from('guest_list_reminders_sent')
        .select('id')
        .eq('event_id', event.id)
        .eq('trigger_type', triggerType)
        .limit(1)
      if (existing && existing.length > 0) {
        console.log(`Already sent ${triggerType} reminder for event ${event.id}`)
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

    // Exclude cancelled RSVPs from headcount/guest list/potluck
    const activeRsvps = (rsvps ?? []).filter((r: any) => r.status !== 'cancelled')

    if (activeRsvps.length === 0) {
      if (preview) {
        return new Response(JSON.stringify({ error: 'No active RSVPs yet for this event' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      continue
    }

    const userIds = [...new Set(activeRsvps.map((r: any) => r.user_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, name, email, family_name')
      .in('id', userIds)
    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    // Fetch event sign-up items (the "potluck" config) and RSVP selections (reclaimed items)
    const { data: signUpItems } = await supabase
      .from('event_sign_up_items')
      .select('id, item_name, quantity_limit, order_index')
      .eq('event_id', event.id)
      .order('order_index', { ascending: true })

    const rsvpIds = activeRsvps.map((r: any) => r.id)
    const { data: selections } = rsvpIds.length
      ? await supabase
          .from('rsvp_sign_up_selections')
          .select('rsvp_id, sign_up_item_id, quantity, description')
          .in('rsvp_id', rsvpIds)
      : { data: [] as any[] }

    const itemMap = new Map((signUpItems ?? []).map((i: any) => [i.id, i]))
    const rsvpById = new Map(activeRsvps.map((r: any) => [r.id, r]))

    let totalRegularAdults = 0
    let totalElders = 0
    let totalInfants = 0
    let totalChildren = 0
    let totalYouth = 0

    const guestList: GuestEntry[] = []
    const potluckItems: PotluckItem[] = []

    // Derive age group key from a dependent entry (mirrors src/lib/age-group-labels.ts)
    const deriveGroup = (d: any): 'infant_0_3' | 'child_4_12' | 'youth_13_17' | 'adult_18_plus' | 'elder' | null => {
      const ag = d?.age_group
      if (ag === 'infant_0_3' || ag === 'child_4_12' || ag === 'youth_13_17' || ag === 'adult_18_plus' || ag === 'elder') return ag
      if (d?.dependent_type === 'elder') return 'elder'
      const age = d?.age
      if (age != null) {
        if (age <= 3) return 'infant_0_3'
        if (age <= 12) return 'child_4_12'
        if (age <= 17) return 'youth_13_17'
        return 'adult_18_plus'
      }
      return null
    }

    for (const r of activeRsvps) {
      const profile = profileMap.get(r.user_id)
      const deps: any[] = (r.attending_dependents as any[]) || []
      const depsOnly = deps.filter((d: any) => d.type === 'dependent')

      let famInfants = 0, famChildren = 0, famYouth = 0, famElders = 0, famAdultDeps = 0
      for (const d of depsOnly) {
        const g = deriveGroup(d)
        if (g === 'infant_0_3') famInfants++
        else if (g === 'child_4_12') famChildren++
        else if (g === 'youth_13_17') famYouth++
        else if (g === 'elder') famElders++
        else if (g === 'adult_18_plus') famAdultDeps++
        else famChildren++ // unknown dependent — default to child bucket (legacy)
      }

      // Adults = total guests minus all categorized dependents (infants/children/youth/elders)
      // Adult-classified dependents still count as adults.
      const adults = Math.max(r.guests_count - famInfants - famChildren - famYouth - famElders, 0)

      totalRegularAdults += adults - famAdultDeps // primary + family_member adults
      totalRegularAdults += famAdultDeps // adult dependents
      totalInfants += famInfants
      totalChildren += famChildren
      totalYouth += famYouth
      totalElders += famElders

      guestList.push({
        name: profile?.name || 'Unknown',
        family: profile?.family_name || undefined,
        adults,
        infants: famInfants,
        children: famChildren,
        youth: famYouth,
        elders: famElders,
      })

      // Legacy single-field potluck (still used for some events)
      if (r.specific_food_item?.trim()) {
        const cat = r.potluck_category
          ? String(r.potluck_category).charAt(0).toUpperCase() + String(r.potluck_category).slice(1)
          : 'Other'
        potluckItems.push({
          category: cat,
          dish: r.specific_food_item,
          family: profile?.family_name || profile?.name || 'Unknown',
          quantity: 1,
        })
      }
    }

    // Map flexible sign-up selections (the actual "reclaimed items")
    const claimedByItem = new Map<number, number>()
    for (const s of (selections ?? []) as any[]) {
      const item = itemMap.get(s.sign_up_item_id)
      const rsvp = rsvpById.get(s.rsvp_id)
      const profile = rsvp ? profileMap.get(rsvp.user_id) : null
      const qty = Math.max(s.quantity ?? 1, 1)
      claimedByItem.set(s.sign_up_item_id, (claimedByItem.get(s.sign_up_item_id) ?? 0) + qty)
      potluckItems.push({
        category: item?.item_name ?? 'Other',
        dish: s.description?.trim() || '(unspecified)',
        family: profile?.family_name || profile?.name || 'Unknown',
        quantity: qty,
      })
    }

    // Sort potluck items by category, then family
    potluckItems.sort((a, b) =>
      a.category.localeCompare(b.category) || a.family.localeCompare(b.family),
    )

    // Compute unclaimed: items with a quantity_limit that still have spots open
    const unclaimedItems: UnclaimedItem[] = (signUpItems ?? [])
      .filter((i: any) => (i.quantity_limit ?? 0) > 0)
      .map((i: any) => {
        const claimed = claimedByItem.get(i.id) ?? 0
        return {
          name: i.item_name,
          claimed,
          limit: i.quantity_limit,
          remaining: Math.max(i.quantity_limit - claimed, 0),
        }
      })
      .filter((u: UnclaimedItem) => u.remaining > 0)

    const totalAdults = totalRegularAdults + totalElders
    const totalHeadcount = totalAdults + totalInfants + totalChildren + totalYouth

    const eventDate = new Date(event.date_time).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
    const eventLocation = event.location
      ? `${event.location}${event.address ? ` — ${event.address}` : ''}`
      : ''

    // Direct link to the check-in poster / QR page for door volunteers.
    // The pin is intentionally NOT embedded in the URL — recipients enter it
    // manually so it never lands in email inboxes, server logs, or referrers.
    const posterUrl = `${APP_URL}/events/${event.id}?action=checkin`

    const reminderLabel =
      triggerType === '5_hour' ? '5-hour reminder'
      : triggerType === '1_hour' ? '1-hour reminder'
      : 'Manual send'

    const templateData = {
      eventTitle: event.title,
      eventDate,
      eventLocation,
      totalHeadcount,
      totalAdults,
      totalElders,
      totalInfants,
      totalChildren,
      totalYouth,
      guestList,
      potluckItems,
      unclaimedItems,
      posterUrl,
      reminderLabel,
      triggerType,
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
            totalInfants,
            totalChildren,
            totalYouth,
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
            idempotencyKey: `guest-list-${event.id}-${recipient.id}-${triggerType}`,
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
          console.log(`Sent guest list (${triggerType}) to ${recipient.email} for event ${event.title}`)
        }
      } catch (e) {
        console.error(`Failed to send guest list to ${recipient.email}:`, e)
      }
    }

    await supabase.from('guest_list_reminders_sent').insert({
      event_id: event.id,
      trigger_type: triggerType,
    })

  }

  console.log(`Guest list reminder complete: ${totalSent} emails sent`)
  return new Response(JSON.stringify({ sent: totalSent }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
