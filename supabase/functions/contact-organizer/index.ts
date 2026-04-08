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

  // Authenticate the caller
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

  // Parse body
  let eventId: string, message: string
  try {
    const body = await req.json()
    eventId = body.event_id
    message = body.message
    if (!eventId || !message?.trim()) throw new Error('Missing fields')
  } catch {
    return new Response(JSON.stringify({ error: 'event_id and message are required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Get sender profile
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('name, email')
    .eq('id', user.id)
    .single()

  const senderName = senderProfile?.name || 'Community Member'
  const senderEmail = senderProfile?.email || user.email || ''

  // Get event with host
  const { data: event } = await supabase
    .from('events')
    .select('id, title, host_id')
    .eq('id', eventId)
    .single()

  if (!event) {
    return new Response(JSON.stringify({ error: 'Event not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Collect all recipient emails: host + all admins + all moderators
  const recipientEmails: string[] = []

  // Get host email
  if (event.host_id) {
    const { data: hostProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', event.host_id)
      .single()
    if (hostProfile?.email) recipientEmails.push(hostProfile.email)
  }

  // Get admin & moderator emails
  const { data: adminModRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .in('role', ['admin', 'moderator'])

  if (adminModRoles && adminModRoles.length > 0) {
    const userIds = [...new Set(adminModRoles.map(r => r.user_id))]
    const { data: adminProfiles } = await supabase
      .from('profiles')
      .select('email')
      .in('id', userIds)

    for (const p of adminProfiles ?? []) {
      if (p.email && !recipientEmails.includes(p.email)) {
        recipientEmails.push(p.email)
      }
    }
  }

  if (recipientEmails.length === 0) {
    return new Response(JSON.stringify({ error: 'No organizers found to contact' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Send the email to each recipient individually via the existing pipeline.
  // Each email has Reply-To set to the sender so organizers can reply directly.
  const contactId = crypto.randomUUID()
  let sent = 0

  for (const recipientEmail of recipientEmails) {
    try {
      await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'contact-organizer',
          recipientEmail,
          idempotencyKey: `contact-org-${contactId}-${recipientEmail}`,
          templateData: {
            eventTitle: event.title,
            senderName,
            senderEmail,
            messageBody: message.trim(),
          },
        },
      })
      sent++
    } catch (e) {
      console.error(`Failed to send contact-organizer to ${recipientEmail}:`, e)
    }
  }

  // Also create in-app notifications for all admins
  const { data: adminRoles } = await supabase
    .from('user_roles')
    .select('user_id')
    .eq('role', 'admin')

  if (adminRoles && adminRoles.length > 0) {
    const notifRows = adminRoles.map((r: any) => ({
      user_id: r.user_id,
      title: `Message from ${senderName}`,
      message: `Re: ${event.title} — "${message.trim().slice(0, 200)}"`,
      type: 'info',
      metadata: {
        action: 'contact_organizer',
        event_id: eventId,
        sender_name: senderName,
        sender_email: senderEmail,
      },
    }))
    await supabase.from('notifications').insert(notifRows)
  }

  console.log(`Contact organizer: ${sent} emails sent for event "${event.title}" from ${senderName}`)

  return new Response(JSON.stringify({ sent }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
