// Deliverability check: SPF / DKIM / DMARC for the configured domains.
// Uses Cloudflare DNS-over-HTTPS (no extra deps).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SENDER_DOMAIN = 'notify.zawya.app'
const ROOT_DOMAIN = 'zawya.app'
// Common DKIM selectors used by Lovable / Resend / SES
const DKIM_SELECTORS = ['resend', 'lovable', 'lvbl', 'mail', 'default', 's1', 's2', 'google']

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
  if (!dmarc) return { status: 'missing', value: null, note: 'No DMARC record found.' }
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
  for (const sel of DKIM_SELECTORS) {
    const host = `${sel}._domainkey.${domain}`
    const [txt, cname] = await Promise.all([dohTxt(host), dohCname(host)])
    if (txt.length) found.push({ selector: sel, value: txt.join(' ').slice(0, 200) })
    else if (cname.length) found.push({ selector: sel, value: `CNAME → ${cname[0]}` })
  }
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
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
    return new Response(JSON.stringify({ checkedAt: new Date().toISOString(), sender, root, alignment }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
