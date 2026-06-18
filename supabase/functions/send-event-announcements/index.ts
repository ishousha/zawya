import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_URL = 'https://zawya.app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  // Auth: internal (cron / service role) or admin only
  const authHeader = req.headers.get('Authorization') ?? ''
  const internalSecret = req.headers.get('x-internal-secret')
  const isInternal = !!serviceKey && internalSecret === serviceKey
  if (!isInternal) {
    if (!authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const token = authHeader.replace('Bearer ', '')
    if (token !== serviceKey) {
      const anon = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const { data: claims } = await anon.auth.getClaims(token)
      const callerId = claims?.claims?.sub
      if (!callerId) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
      const { data: isAdmin } = await anon.rpc('has_role', { _user_id: callerId, _role: 'admin' })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey)
  const nowIso = new Date().toISOString()
  let totalSent = 0

  const { data: dueEvents, error: fetchErr } = await supabase
    .from('events')
    .select('id, title, description, date_time, location, address, host_id, cover_photo_url, short_code, virtual_link, is_hybrid, event_type_id')
    .eq('published', true)
    .is('announcement_sent_at', null)
    .not('announcement_send_at', 'is', null)
    .lte('announcement_send_at', nowIso)

  if (fetchErr) {
    console.error('Fetch due events error:', fetchErr)
    return new Response(JSON.stringify({ error: fetchErr.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!dueEvents || dueEvents.length === 0) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Approved members
  const { data: approvedRoles } = await supabase
    .from('user_roles').select('user_id').eq('role', 'approved')
  const approvedIds = [...new Set((approvedRoles ?? []).map((r: any) => r.user_id))]

  if (approvedIds.length === 0) {
    await supabase.from('events').update({ announcement_sent_at: nowIso }).in('id', dueEvents.map((e: any) => e.id))
    return new Response(JSON.stringify({ sent: 0, marked: dueEvents.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: profiles } = await supabase
    .from('profiles').select('id, name, email, notification_preferences').in('id', approvedIds)

  const recipients = (profiles ?? []).filter((p: any) =>
    p.email && (p.notification_preferences?.events !== false)
  )

  for (const event of dueEvents) {
    let hostName = ''
    if (event.host_id) {
      const { data: host } = await supabase.from('profiles').select('name').eq('id', event.host_id).maybeSingle()
      hostName = host?.name ?? ''
    }
    let eventType = ''
    if (event.event_type_id) {
      const { data: et } = await supabase.from('event_types').select('name').eq('id', event.event_type_id).maybeSingle()
      eventType = et?.name ?? ''
    }

    const eventDate = new Date(event.date_time).toLocaleString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    })
    const locationParts = [event.location, event.address].filter(Boolean).join(' — ')
    const eventLocation = locationParts || (event.virtual_link ? 'Online' : '')
    const eventUrl = event.short_code ? `${SITE_URL}/e/${event.short_code}` : `${SITE_URL}/event/${event.id}`

    for (const p of recipients) {
      try {
        await supabase.functions.invoke('send-transactional-email', {
          body: {
            templateName: 'event-announcement',
            recipientEmail: p.email,
            idempotencyKey: `event-announce-${event.id}-${p.id}`,
            templateData: {
              memberName: p.name || undefined,
              eventTitle: event.title,
              eventDate,
              eventLocation,
              eventType,
              hostName,
              description: event.description || '',
              coverPhotoUrl: event.cover_photo_url || '',
              eventUrl,
            },
          },
        })
        totalSent++
      } catch (e) {
        console.error(`Announcement send failed for ${p.email}:`, e)
      }
    }

    await supabase.from('events').update({ announcement_sent_at: new Date().toISOString() }).eq('id', event.id)
  }

  console.log(`Event announcements complete: ${totalSent} emails sent across ${dueEvents.length} events`)
  return new Response(JSON.stringify({ sent: totalSent, events: dueEvents.length }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
