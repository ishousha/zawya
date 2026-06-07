// Deliverability check: SPF / DKIM / DMARC for the configured domains.
// Uses Cloudflare DNS-over-HTTPS (no extra deps).

import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SENDER_DOMAIN = 'notify.zawya.app'
const ROOT_DOMAIN = 'zawya.app'

// DKIM selectors used by common providers + Mailgun variants.
// Mailgun typically publishes `k1`, `mx`, `smtp`, `mailo`, `pic`, `krs`, `mta`.
const DKIM_SELECTORS = [
  // Mailgun
  'k1', 'k2', 'mx', 'smtp', 'mailo', 'pic', 'krs', 'mta',
  // Resend / Lovable / common providers
  'resend', 'lovable', 'lvbl', 'mail', 'default', 's1', 's2', 'google',
  'selector1', 'selector2', 'dkim',
]

// Tightening rule: at least N consecutive daily checks where org DMARC was
// detected, policy still p=none, and the earliest such check is at least
// MIN_DAYS_STABLE days ago.
const MIN_CONSECUTIVE_OK = 5
const MIN_DAYS_STABLE = 5

async function dohTxt(name: string): Promise<string[]> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`, {
      headers: { accept: 'application/dns-json' },
    })
    if (!res.ok) return []
    const json = await res.json()
    const answers = (json.Answer ?? []) as Array<{ data: string; type: number }>
    return answers
      .filter((a) => a.type === 16)
      .map((a) => a.data.replace(/^"|"$/g, '').replace(/" "/g, ''))
  } catch {
    return []
  }
}

async function dohCname(name: string): Promise<string[]> {
  try {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=CNAME`, {
      headers: { accept: 'application/dns-json' },
    })
    if (!res.ok) return []
    const json = await res.json()
    return ((json.Answer ?? []) as Array<{ data: string; type: number }>)
      .filter((a) => a.type === 5)
      .map((a) => a.data)
  } catch {
    return []
  }
}

function checkSpf(records: string[]) {
  const spf = records.find((r) => r.toLowerCase().startsWith('v=spf1'))
  if (!spf) return { status: 'missing', value: null, note: 'No SPF record found.' }
  const hasAll = /[~\-+?]all\b/i.test(spf)
  return {
    status: hasAll ? 'ok' : 'warn',
    value: spf,
    note: hasAll ? 'SPF found.' : 'SPF found but missing an "all" mechanism.',
  }
}

function checkDmarc(records: string[]) {
  const dmarc = records.find((r) => r.toLowerCase().startsWith('v=dmarc1'))
  if (!dmarc) return { status: 'missing', value: null, policy: null as string | null, note: 'No DMARC record found.' }
  const policy = /p=(none|quarantine|reject)/i.exec(dmarc)?.[1]?.toLowerCase() ?? 'unknown'
  return {
    status: policy === 'none' ? 'warn' : 'ok',
    value: dmarc,
    policy,
    note: policy === 'none'
      ? 'DMARC in monitor mode (p=none). Tighten to quarantine/reject when ready.'
      : `DMARC enforced (p=${policy}).`,
  }
}

async function checkDkim(domain: string) {
  const found: Array<{ selector: string; value: string }> = []
  // Probe in parallel — much faster than sequential.
  const probes = await Promise.all(DKIM_SELECTORS.map(async (sel) => {
    const host = `${sel}._domainkey.${domain}`
    const [txt, cname] = await Promise.all([dohTxt(host), dohCname(host)])
    if (txt.length) return { selector: sel, value: txt.join(' ').slice(0, 200) }
    if (cname.length) return { selector: sel, value: `CNAME → ${cname[0]}` }
    return null
  }))
  for (const p of probes) if (p) found.push(p)
  return found.length
    ? { status: 'ok', selectors: found, note: `${found.length} DKIM selector(s) published.` }
    : { status: 'unknown', selectors: [], note: 'No DKIM selectors found at common names (DKIM may still exist under another selector).' }
}

async function checkDomain(domain: string) {
  const txt = await dohTxt(domain)
  return {
    domain,
    spf: checkSpf(txt),
    dmarc: checkDmarc(await dohTxt(`_dmarc.${domain}`)),
    dkim: await checkDkim(domain),
  }
}

interface DmarcRecommendation {
  ready_to_tighten: boolean
  current_policy: string | null
  consecutive_ok: number
  days_stable: number
  required_consecutive: number
  required_days: number
  suggested_record: string
  reason: string
}

async function computeRecommendation(
  admin: ReturnType<typeof createClient>,
  currentPolicy: string | null,
): Promise<DmarcRecommendation> {
  const suggested = 'v=DMARC1; p=quarantine; rua=mailto:dmarc@zawya.app; aspf=r; adkim=r; pct=100;'

  if (!currentPolicy) {
    return {
      ready_to_tighten: false, current_policy: null, consecutive_ok: 0, days_stable: 0,
      required_consecutive: MIN_CONSECUTIVE_OK, required_days: MIN_DAYS_STABLE,
      suggested_record: suggested, reason: 'DMARC not yet detected on root domain.',
    }
  }
  if (currentPolicy !== 'none') {
    return {
      ready_to_tighten: false, current_policy: currentPolicy, consecutive_ok: 0, days_stable: 0,
      required_consecutive: MIN_CONSECUTIVE_OK, required_days: MIN_DAYS_STABLE,
      suggested_record: suggested,
      reason: `DMARC is already enforced (p=${currentPolicy}). No tightening needed.`,
    }
  }

  // Walk back through automated checks; count consecutive ok ones.
  const { data: rows } = await admin
    .from('deliverability_checks')
    .select('checked_at, dmarc_org_present, dmarc_policy')
    .order('checked_at', { ascending: false })
    .limit(30)

  let consecutive = 0
  let earliest: string | null = null
  for (const r of (rows ?? [])) {
    const policy = (r as { dmarc_policy: string | null }).dmarc_policy
    const present = (r as { dmarc_org_present: boolean }).dmarc_org_present
    if (present && policy === 'none') {
      consecutive++
      earliest = (r as { checked_at: string }).checked_at
    } else break
  }

  const daysStable = earliest
    ? Math.floor((Date.now() - new Date(earliest).getTime()) / 86_400_000)
    : 0

  const ready = consecutive >= MIN_CONSECUTIVE_OK && daysStable >= MIN_DAYS_STABLE
  return {
    ready_to_tighten: ready,
    current_policy: 'none',
    consecutive_ok: consecutive,
    days_stable: daysStable,
    required_consecutive: MIN_CONSECUTIVE_OK,
    required_days: MIN_DAYS_STABLE,
    suggested_record: suggested,
    reason: ready
      ? `${consecutive} consecutive clean checks over ${daysStable} day(s). Safe to tighten to p=quarantine.`
      : `Need ${MIN_CONSECUTIVE_OK} consecutive clean checks (${consecutive}) and ${MIN_DAYS_STABLE} days stable (${daysStable}) before tightening.`,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    // Admin-only: validate JWT and ensure the caller has the admin role.
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const token = authHeader.replace('Bearer ', '')
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token)
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const { data: isAdmin } = await userClient.rpc('has_role', {
      _user_id: claimsData.claims.sub, _role: 'admin',
    })
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let body: { persist?: boolean; source?: string } = {}
    try { body = await req.json() } catch { /* no body */ }

    const [sender, root] = await Promise.all([
      checkDomain(SENDER_DOMAIN),
      checkDomain(ROOT_DOMAIN),
    ])
    const alignment = {
      from_domain: SENDER_DOMAIN,
      spf_aligned: sender.spf.status === 'ok',
      dkim_aligned: sender.dkim.status === 'ok',
      dmarc_present_org: root.dmarc.status !== 'missing',
      note: 'For strict DMARC alignment, the From: domain should match (or be a subdomain of) the SPF/DKIM signing domain.',
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    let persisted = false
    let skippedReason: string | null = null
    if (body.persist) {
      // Stop persisting only once DMARC is enforced (quarantine/reject) — we
      // want to keep recording while in p=none so we can detect stability.
      const isEnforced = root.dmarc.policy === 'quarantine' || root.dmarc.policy === 'reject'
      if (isEnforced) {
        skippedReason = 'dmarc_enforced'
      } else {
        const { error } = await admin.from('deliverability_checks').insert({
          sender, root, alignment,
          dmarc_org_present: alignment.dmarc_present_org,
          dmarc_policy: root.dmarc.policy ?? null,
          source: body.source ?? 'manual',
        })
        if (error) skippedReason = `insert_failed: ${error.message}`
        else persisted = true
      }
    }

    const recommendation = await computeRecommendation(admin, root.dmarc.policy ?? null)

    return new Response(JSON.stringify({
      checkedAt: new Date().toISOString(),
      sender, root, alignment, persisted, skippedReason,
      recommendation,
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
