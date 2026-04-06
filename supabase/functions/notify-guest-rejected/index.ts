import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const webhookUrl = Deno.env.get('N8N_GUEST_REJECTED_WEBHOOK_URL')
  if (!webhookUrl) {
    console.error('N8N_GUEST_REJECTED_WEBHOOK_URL is not configured')
    return new Response(
      JSON.stringify({ error: 'Webhook URL not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  let body: {
    guest_name: string
    event_title: string
    requesting_user_name: string
    requesting_user_email: string
  }

  try {
    body = await req.json()
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { guest_name, event_title, requesting_user_name, requesting_user_email } = body

  if (!guest_name || !event_title || !requesting_user_name || !requesting_user_email) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Deliberately exclude guest_email from payload
  const payload = {
    guest_name,
    event_title,
    requesting_user_name,
    requesting_user_email,
    rejected_at: new Date().toISOString(),
  }

  try {
    const resp = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      const text = await resp.text()
      console.error(`Webhook failed [${resp.status}]:`, text)
      return new Response(
        JSON.stringify({ error: `Webhook returned ${resp.status}` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Guest rejection webhook sent successfully', { guest_name, event_title })

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Webhook request failed:', err)
    return new Response(
      JSON.stringify({ error: 'Webhook request failed' }),
      { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
