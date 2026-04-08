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
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Verify the caller is an admin
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check admin role
  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'moderator'])
    .limit(1)
    .maybeSingle()

  if (!roleRow) {
    return new Response(JSON.stringify({ error: 'Forbidden — admin or moderator only' }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let eventId: string, customSubject: string, customMessage: string
  try {
    const body = await req.json()
    eventId = body.event_id
    customSubject = body.subject
    customMessage = body.message
    if (!eventId || !customSubject || !customMessage) throw new Error('Missing fields')
  } catch {
    return new Response(JSON.stringify({ error: 'event_id, subject, and message are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch event
  const { data: event } = await supabase
    .from('events')
    .select('id, title')
    .eq('id', eventId)
    .single()

  if (!event) {
    return new Response(JSON.stringify({ error: 'Event not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Fetch confirmed RSVPs
  const { data: rsvps } = await supabase
    .from('rsvps')
    .select('user_id')
    .eq('event_id', eventId)
    .eq('is_waitlisted', false)

  if (!rsvps || rsvps.length === 0) {
    return new Response(JSON.stringify({ sent: 0, message: 'No attendees to notify' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const userIds = [...new Set(rsvps.map((r: any) => r.user_id))]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email')
    .in('id', userIds)

  const broadcastId = crypto.randomUUID()
  let sent = 0

  for (const profile of profiles ?? []) {
    if (!profile.email) continue
    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'event-broadcast',
          recipientEmail: profile.email,
          idempotencyKey: `broadcast-${broadcastId}-${profile.id}`,
          templateData: {
            eventTitle: event.title,
            memberName: profile.name || undefined,
            customSubject,
            customMessage,
          },
        },
      })
      sent++
    } catch (e) {
      console.error(`Failed to send broadcast to ${profile.email}:`, e)
    }
  }

  // Log admin activity
  await supabase.from('admin_activity_log').insert({
    actor_id: user.id,
    action: 'event_broadcast_sent',
    details: { event_id: eventId, event_title: event.title, recipients: sent, subject: customSubject },
  })

  console.log(`Broadcast sent to ${sent} attendees for event ${event.title}`)
  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
