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
  category?: string
}

interface RecipientPreview {
  name: string | null
  email: string
}

const jsonResponse = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return String(error)
}

const getErrorStatus = (error: unknown) => {
  if (typeof error === 'object' && error && 'context' in error) {
    const context = (error as { context?: { status?: unknown } }).context
    if (typeof context?.status === 'number') return context.status
  }
  return null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[guest-list] Missing required environment variables')
    return jsonResponse({ error: 'Server configuration error' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

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
      preview = body.preview === true
    } catch {
      // No body = auto mode (cron trigger)
    }
  }

  console.info(`[guest-list] mode=${mode} eventId=${targetEventId} preview=${preview}`)

  let callerId: string | null = null
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '')
    const authClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: claimsData } = await authClient.auth.getClaims(token)
    callerId = typeof claimsData?.claims?.sub === 'string' ? claimsData.claims.sub : null
  }

  let events: any[] = []

  if (mode === 'manual' && targetEventId) {
    const { data, error } = await supabase
      .from('events')
      .select('id, title, date_time, location, address, host_id, status')
      .eq('id', targetEventId)
      .in('status', ['active', 'full'])
      .maybeSingle()

    if (error) {
      console.error('[guest-list] Failed to load manual event', { eventId: targetEventId, error })
      return jsonResponse({ error: 'Failed to load event' }, 500)
    }
    if (data) events = [data]
  } else {
    const now = new Date()
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000)
    const buffer = new Date(now.getTime() + 2 * 60 * 60 * 1000 + 10 * 60 * 1000)

    const { data, error } = await supabase
      .from('events')
      .select('id, title, date_time, location, address, host_id, status')
      .in('status', ['active', 'full'])
      .gte('date_time', twoHoursLater.toISOString())
      .lte('date_time', buffer.toISOString())

    if (error) {
      console.error('[guest-list] Failed to load automatic events', { error })
      return jsonResponse({ error: 'Failed to load events' }, 500)
    }
    events = data ?? []
  }

  if (events.length === 0) {
    console.info('[guest-list] No events to send reminders for')
    return jsonResponse({ sent: 0, error: mode === 'manual' ? 'No active event found' : undefined }, mode === 'manual' ? 404 : 200)
  }

  let totalSent = 0
  let totalErrors = 0
  const errors: Array<{ recipient?: string; status?: number | null; message: string }> = []

  for (const event of events) {
    if (mode === 'manual') {
      if (!callerId) {
        console.warn('[guest-list] Manual request missing authenticated caller', { eventId: event.id })
        return jsonResponse({ error: 'Authentication required' }, 401)
      }

      const { data: callerRole } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', callerId)
        .in('role', ['admin', 'moderator'])
        .limit(1)
        .maybeSingle()

      if (!callerRole && event.host_id !== callerId) {
        console.warn('[guest-list] Unauthorized manual request', { eventId: event.id, callerId })
        return jsonResponse({ error: 'Not authorized to send this guest list' }, 403)
      }
    }

    if (mode === 'auto') {
      const { data: existing, error: existingError } = await supabase
        .from('guest_list_reminders_sent')
        .select('id')
        .eq('event_id', event.id)
        .eq('trigger_type', 'auto')
        .limit(1)

      if (existingError) {
        totalErrors++
        errors.push({ message: `Failed to check reminder history for ${event.title}` })
        console.error('[guest-list] Failed to check reminder history', { eventId: event.id, error: existingError })
        continue
      }
      if (existing && existing.length > 0) {
        console.info(`[guest-list] Already sent auto reminder for event ${event.id}`)
        continue
      }
    }

    const { data: rsvps, error: rsvpError } = await supabase
      .from('rsvps')
      .select('*')
      .eq('event_id', event.id)
      .neq('status', 'cancelled')

    if (rsvpError) {
      totalErrors++
      errors.push({ message: `Failed to load RSVPs for ${event.title}` })
      console.error('[guest-list] Failed to load RSVPs', { eventId: event.id, error: rsvpError })
      continue
    }
    if (!rsvps || rsvps.length === 0) continue

    const userIds = [...new Set(rsvps.map((r: any) => r.user_id).filter(Boolean))]
    const { data: profiles, error: profilesError } = userIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, name, email, family_name')
          .in('id', userIds)
      : { data: [], error: null }

    if (profilesError) {
      totalErrors++
      errors.push({ message: `Failed to load guest profiles for ${event.title}` })
      console.error('[guest-list] Failed to load guest profiles', { eventId: event.id, error: profilesError })
      continue
    }

    const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]))

    let totalRegularAdults = 0
    let totalElders = 0
    let totalChildren = 0
    const guestList: GuestEntry[] = []

    for (const r of rsvps) {
      const profile = profileMap.get(r.user_id)
      const deps: any[] = Array.isArray(r.attending_dependents) ? r.attending_dependents : []
      const childDeps = deps.filter((d: any) => d.type === 'dependent' && d.dependent_type !== 'elder')
      const elderDeps = deps.filter((d: any) => d.type === 'dependent' && d.dependent_type === 'elder')
      const regularAdults = Math.max((r.guests_count ?? 1) - childDeps.length - elderDeps.length, 0)

      totalRegularAdults += regularAdults
      totalElders += elderDeps.length
      totalChildren += childDeps.length

      guestList.push({
        name: profile?.name || 'Unknown',
        family: profile?.family_name || undefined,
        adults: regularAdults + elderDeps.length,
        children: childDeps.length,
        elders: elderDeps.length,
      })
    }

    const potluckItems: PotluckItem[] = []

    try {
      const { data: rpcItems, error: rpcError } = await supabase.rpc('get_event_potluck_menu', { _event_id: event.id })
      if (rpcError) throw rpcError

      for (const item of rpcItems ?? []) {
        potluckItems.push({
          category: item.category || 'Other',
          dish: item.dish?.trim() || 'Undecided',
          family: item.family_name || item.claimant_name || 'Unknown',
        })
      }
    } catch (rpcError) {
      console.warn('[guest-list] Potluck RPC unavailable, using fallback aggregation', { eventId: event.id, error: rpcError })

      for (const r of rsvps) {
        const profile = profileMap.get(r.user_id)
        if (r.specific_food_item?.trim()) {
          potluckItems.push({
            category: r.potluck_category || 'Other',
            dish: r.specific_food_item.trim(),
            family: profile?.family_name || profile?.name || 'Unknown',
          })
        }
      }

      const rsvpIds = rsvps.map((r: any) => r.id)
      const { data: selections, error: selectionsError } = await supabase
        .from('rsvp_sign_up_selections')
        .select('rsvp_id, sign_up_item_id, quantity, description')
        .in('rsvp_id', rsvpIds)

      if (selectionsError) {
        console.error('[guest-list] Failed fallback potluck selections lookup', { eventId: event.id, error: selectionsError })
      } else if (selections && selections.length > 0) {
        const itemIds = [...new Set(selections.map((s: any) => s.sign_up_item_id).filter(Boolean))]
        const { data: items, error: itemsError } = await supabase
          .from('event_sign_up_items')
          .select('id, item_name')
          .in('id', itemIds)

        if (itemsError) {
          console.error('[guest-list] Failed fallback sign-up items lookup', { eventId: event.id, error: itemsError })
        } else {
          const itemMap = new Map((items ?? []).map((item: any) => [String(item.id), item.item_name]))
          const rsvpMap = new Map(rsvps.map((r: any) => [r.id, r]))

          for (const selection of selections) {
            const rsvp = rsvpMap.get(selection.rsvp_id)
            const profile = rsvp ? profileMap.get(rsvp.user_id) : null
            const quantity = Math.max(selection.quantity ?? 1, 1)
            for (let i = 0; i < quantity; i++) {
              potluckItems.push({
                category: itemMap.get(String(selection.sign_up_item_id)) || 'Other',
                dish: selection.description?.trim() || 'Undecided',
                family: profile?.family_name || profile?.name || 'Unknown',
              })
            }
          }
        }
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

    const recipientIds = new Set<string>()
    if (event.host_id) recipientIds.add(event.host_id)

    const { data: adminRoles, error: adminRolesError } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['admin', 'moderator'])

    if (adminRolesError) {
      totalErrors++
      errors.push({ message: `Failed to load admin recipients for ${event.title}` })
      console.error('[guest-list] Failed to load admin recipients', { eventId: event.id, error: adminRolesError })
      continue
    }

    for (const r of adminRoles ?? []) recipientIds.add(r.user_id)

    const ids = Array.from(recipientIds)
    const { data: recipientProfiles, error: recipientError } = ids.length > 0
      ? await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', ids)
      : { data: [], error: null }

    if (recipientError) {
      totalErrors++
      errors.push({ message: `Failed to load recipient emails for ${event.title}` })
      console.error('[guest-list] Failed to load recipient emails', { eventId: event.id, error: recipientError })
      continue
    }

    const recipients: RecipientPreview[] = (recipientProfiles ?? [])
      .filter((recipient: any) => Boolean(recipient.email))
      .map((recipient: any) => ({ name: recipient.name ?? null, email: recipient.email }))

    const guestTemplate = TEMPLATES['guest-list-reminder']
    const subject = typeof guestTemplate.subject === 'function'
      ? guestTemplate.subject(templateData)
      : guestTemplate.subject

    if (preview) {
      const html = await renderAsync(React.createElement(guestTemplate.component, {
        ...templateData,
        recipientName: recipients[0]?.name || undefined,
      }))

      return jsonResponse({
        preview: true,
        subject,
        html,
        recipients,
        guestList,
        potluckItems,
        summary: {
          totalHeadcount,
          totalAdults,
          totalElders,
          totalChildren,
          guestCount: guestList.length,
          potluckCount: potluckItems.length,
        },
      })
    }

    for (const recipient of recipientProfiles ?? []) {
      if (!recipient.email) continue

      try {
        const { data: sendResult, error: sendError } = await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'guest-list-reminder',
            recipientEmail: recipient.email,
            idempotencyKey: `guest-list-${event.id}-${recipient.id}-${mode}-${Date.now()}`,
            templateData: {
              ...templateData,
              recipientName: recipient.name || undefined,
            },
          },
        })

        if (sendError) throw sendError
        if (sendResult?.success === false) throw new Error(sendResult.reason || 'Email was not queued')

        totalSent++
        console.info(`[guest-list] Queued guest list to ${recipient.email} for ${event.title}`)
      } catch (e) {
        totalErrors++
        const status = getErrorStatus(e)
        const message = getErrorMessage(e)
        errors.push({ recipient: recipient.email, status, message })
        console.error('[guest-list] send failure', {
          eventId: event.id,
          recipient: recipient.email,
          status,
          message,
          error: e,
        })
      }
    }

    if (totalSent > 0) {
      const { error: recordError } = await supabase.from('guest_list_reminders_sent').insert({
        event_id: event.id,
        trigger_type: mode,
      })
      if (recordError) {
        console.error('[guest-list] Failed to record send', { eventId: event.id, error: recordError })
      }
    }
  }

  console.info(`[guest-list] Complete: ${totalSent} sent, ${totalErrors} errors`)

  if (mode === 'manual' && totalSent === 0 && totalErrors > 0) {
    return jsonResponse({ sent: totalSent, errors, error: errors[0]?.message || 'Failed to send guest list email' }, 502)
  }

  return jsonResponse({ sent: totalSent, errors })
})
