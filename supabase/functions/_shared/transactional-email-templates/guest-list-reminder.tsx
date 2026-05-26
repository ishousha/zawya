import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface GuestEntry {
  name: string
  family?: string
  adults: number
  infants?: number
  children: number
  youth?: number
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

interface GuestListReminderProps {
  recipientName?: string
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  totalHeadcount?: number
  totalAdults?: number
  totalElders?: number
  totalInfants?: number
  totalChildren?: number
  totalYouth?: number
  guestList?: GuestEntry[]
  potluckItems?: PotluckItem[]
  unclaimedItems?: UnclaimedItem[]
  posterUrl?: string
  reminderLabel?: string
}

const GuestListReminderEmail = ({
  recipientName,
  eventTitle,
  eventDate,
  eventLocation,
  totalHeadcount = 0,
  totalAdults = 0,
  totalElders = 0,
  totalInfants = 0,
  totalChildren = 0,
  totalYouth = 0,
  guestList = [],
  potluckItems = [],
  unclaimedItems = [],
  posterUrl,
  reminderLabel,
}: GuestListReminderProps) => {
  // Group potluck items by category for display
  const potluckByCategory = potluckItems.reduce<Record<string, PotluckItem[]>>((acc, item) => {
    const key = item.category || 'Other'
    ;(acc[key] = acc[key] || []).push(item)
    return acc
  }, {})
  const potluckCategories = Object.keys(potluckByCategory).sort()
  return (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Guest list for {eventTitle || 'your event'} — {totalHeadcount} attending</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Guest List {reminderLabel ? `— ${reminderLabel}` : 'Reminder'}</Heading>
        <Text style={text}>
          {recipientName ? `Assalamu Alaikum ${recipientName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={text}>
          Here is the guest list for <strong>{eventTitle || 'the upcoming event'}</strong>
          {eventDate ? ` on ${eventDate}` : ''}.
          {eventLocation ? ` Location: ${eventLocation}.` : ''}
        </Text>

        {posterUrl && (
          <Section style={{ textAlign: 'center', margin: '16px 0 8px' }}>
            <Button href={posterUrl} style={posterButton}>
              Open Check-in Poster &amp; QR
            </Button>
            <Text style={{ ...textMuted, marginTop: '6px' }}>
              Share this link with door volunteers to scan tickets and check guests in.
            </Text>
          </Section>
        )}


        {/* Headcount Summary */}
        <Section style={summarySection}>
          <Heading style={h2}>Headcount Summary</Heading>
          <table style={summaryTable}>
            <tbody>
              <tr>
                <td style={summaryCell}><strong style={summaryNum}>{totalHeadcount}</strong><br /><span style={summaryLabel}>Total</span></td>
                <td style={summaryCell}><strong style={summaryNum}>{totalAdults}</strong><br /><span style={summaryLabel}>Adults</span></td>
                <td style={summaryCell}><strong style={summaryNum}>{totalElders}</strong><br /><span style={summaryLabel}>Elders</span></td>
              </tr>
              <tr>
                <td style={summaryCell}><strong style={summaryNum}>{totalInfants}</strong><br /><span style={summaryLabel}>Infants (0-3)</span></td>
                <td style={summaryCell}><strong style={summaryNum}>{totalChildren}</strong><br /><span style={summaryLabel}>Kids (4-12)</span></td>
                <td style={summaryCell}><strong style={summaryNum}>{totalYouth}</strong><br /><span style={summaryLabel}>Youth (13-17)</span></td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Hr style={hr} />

        {/* Guest List */}
        <Section>
          <Heading style={h2}>Guest List ({guestList.length} families)</Heading>
          {guestList.length === 0 ? (
            <Text style={textMuted}>No RSVPs yet.</Text>
          ) : (
            <table style={listTable}>
              <tbody>
                {guestList.map((g, i) => {
                  const parts: string[] = []
                  if (g.adults > 0) parts.push(`${g.adults} adult${g.adults !== 1 ? 's' : ''}`)
                  if (g.elders > 0) parts.push(`${g.elders} elder${g.elders !== 1 ? 's' : ''}`)
                  if ((g.infants ?? 0) > 0) parts.push(`${g.infants} infant${g.infants !== 1 ? 's' : ''} (0-3)`)
                  if (g.children > 0) parts.push(`${g.children} kid${g.children !== 1 ? 's' : ''} (4-12)`)
                  if ((g.youth ?? 0) > 0) parts.push(`${g.youth} youth (13-17)`)
                  return (
                    <tr key={i}>
                      <td style={listCell}>
                        <strong>{g.name}</strong>
                        {g.family ? <span style={{ color: '#6b7280' }}> — {g.family}</span> : null}
                        <br />
                        <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                          {parts.join(', ')}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </Section>

        {/* Potluck Items — grouped by category (reclaimed sign-up items) */}
        {potluckItems.length > 0 && (
          <>
            <Hr style={hr} />
            <Section>
              <Heading style={h2}>Potluck Menu (Reclaimed)</Heading>
              {potluckCategories.map((cat) => (
                <div key={cat} style={{ marginBottom: '12px' }}>
                  <Text style={categoryLabel}>{cat}</Text>
                  <table style={listTable}>
                    <tbody>
                      {potluckByCategory[cat].map((item, i) => (
                        <tr key={i}>
                          <td style={listCell}>
                            🍽 {item.dish}
                            {item.quantity > 1 ? ` ×${item.quantity}` : ''}
                            {' — '}
                            <span style={{ color: '#6b7280' }}>{item.family}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </Section>
          </>
        )}

        {/* Unclaimed sign-up items (still need volunteers) */}
        {unclaimedItems.length > 0 && (
          <>
            <Hr style={hr} />
            <Section>
              <Heading style={h2}>Still Needed (Unclaimed)</Heading>
              <table style={listTable}>
                <tbody>
                  {unclaimedItems.map((u, i) => (
                    <tr key={i}>
                      <td style={listCell}>
                        ⚠ <strong>{u.name}</strong> — {u.remaining} of {u.limit} still unclaimed
                        {u.claimed > 0 ? ` (${u.claimed} claimed)` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}

        <Hr style={hr} />
        <Text style={footer}>
          — The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
  )
}

export const template = {
  component: GuestListReminderEmail,
  subject: (data: Record<string, any>) => {
    const label = data.reminderLabel ? ` (${data.reminderLabel})` : ''
    return data.eventTitle
      ? `Guest List${label}: ${data.eventTitle} — ${data.totalHeadcount || 0} attending`
      : `Guest List Reminder${label}`
  },
  displayName: 'Guest list reminder (5h & 1h before event)',
  previewData: {
    recipientName: 'Ahmed',
    eventTitle: 'Friday Gathering',
    eventDate: 'Friday, January 15, 2026 at 7:00 PM',
    eventLocation: 'Community Hall',
    reminderLabel: '1-hour reminder',
    posterUrl: 'https://zawya.app/events/example?action=checkin&pin=1234',
    totalHeadcount: 42,
    totalAdults: 25,
    totalElders: 5,
    totalInfants: 2,
    totalChildren: 8,
    totalYouth: 2,
    guestList: [
      { name: 'Ahmed', family: 'Abushousha', adults: 2, infants: 1, children: 2, youth: 0, elders: 1 },
      { name: 'Fatima', family: 'Al-Hassan', adults: 1, infants: 0, children: 0, youth: 0, elders: 0 },
    ],
    potluckItems: [
      { category: 'Appetizers', dish: 'Hummus', family: 'Abushousha', quantity: 1 },
      { category: 'Mains', dish: 'Biryani', family: 'Al-Hassan', quantity: 2 },
    ],
    unclaimedItems: [
      { name: 'Dessert', claimed: 1, limit: 3, remaining: 2 },
    ],
  },

} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '520px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#166534', margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }
const h2 = { fontSize: '16px', fontWeight: '600' as const, color: '#374151', margin: '0 0 12px', fontFamily: "'Playfair Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const textMuted = { fontSize: '14px', color: '#9ca3af', fontStyle: 'italic' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
const summarySection = { margin: '0 0 8px' }
const summaryTable = { width: '100%', borderCollapse: 'collapse' as const }
const summaryCell = { textAlign: 'center' as const, padding: '12px 8px', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px' }
const summaryNum = { fontSize: '24px', color: '#166534', display: 'block', marginBottom: '2px' }
const summaryLabel = { fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.5px' }
const listTable = { width: '100%', borderCollapse: 'collapse' as const }
const listCell = { padding: '8px 12px', borderBottom: '1px solid #f3f4f6', fontSize: '14px', color: '#374151' }
const categoryLabel = { fontSize: '12px', fontWeight: '600' as const, color: '#166534', textTransform: 'uppercase' as const, letterSpacing: '0.5px', margin: '0 0 4px' }
const posterButton = { backgroundColor: '#166534', color: '#ffffff', padding: '12px 20px', borderRadius: '6px', fontSize: '14px', fontWeight: '600' as const, textDecoration: 'none', display: 'inline-block', fontFamily: "'Inter', Arial, sans-serif" }
