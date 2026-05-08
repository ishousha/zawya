import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface GuestEntry {
  name: string
  family?: string
  adults: number
  children: number
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
  totalChildren?: number
  guestList?: GuestEntry[]
  potluckItems?: PotluckItem[]
  unclaimedItems?: UnclaimedItem[]
}

const GuestListReminderEmail = ({
  recipientName,
  eventTitle,
  eventDate,
  eventLocation,
  totalHeadcount = 0,
  totalAdults = 0,
  totalElders = 0,
  totalChildren = 0,
  guestList = [],
  potluckItems = [],
  unclaimedItems = [],
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
        <Heading style={h1}>Guest List Reminder</Heading>
        <Text style={text}>
          {recipientName ? `Assalamu Alaikum ${recipientName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={text}>
          Here is the guest list for <strong>{eventTitle || 'the upcoming event'}</strong>
          {eventDate ? ` on ${eventDate}` : ''}.
          {eventLocation ? ` Location: ${eventLocation}.` : ''}
        </Text>

        {/* Headcount Summary */}
        <Section style={summarySection}>
          <Heading style={h2}>Headcount Summary</Heading>
          <table style={summaryTable}>
            <tbody>
              <tr>
                <td style={summaryCell}><strong style={summaryNum}>{totalHeadcount}</strong><br /><span style={summaryLabel}>Total</span></td>
                <td style={summaryCell}><strong style={summaryNum}>{totalAdults}</strong><br /><span style={summaryLabel}>Adults</span></td>
                <td style={summaryCell}><strong style={summaryNum}>{totalElders}</strong><br /><span style={summaryLabel}>Elders</span></td>
                <td style={summaryCell}><strong style={summaryNum}>{totalChildren}</strong><br /><span style={summaryLabel}>Children</span></td>
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
                {guestList.map((g, i) => (
                  <tr key={i}>
                    <td style={listCell}>
                      <strong>{g.name}</strong>
                      {g.family ? <span style={{ color: '#6b7280' }}> — {g.family}</span> : null}
                      <br />
                      <span style={{ fontSize: '12px', color: '#9ca3af' }}>
                        {g.adults} adult{g.adults !== 1 ? 's' : ''}
                        {g.elders > 0 ? `, ${g.elders} elder${g.elders !== 1 ? 's' : ''}` : ''}
                        {g.children > 0 ? `, ${g.children} kid${g.children !== 1 ? 's' : ''}` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        {/* Potluck Items */}
        {potluckItems.length > 0 && (
          <>
            <Hr style={hr} />
            <Section>
              <Heading style={h2}>Potluck Menu</Heading>
              <table style={listTable}>
                <tbody>
                  {potluckItems.map((item, i) => (
                    <tr key={i}>
                      <td style={listCell}>
                        🍽 {item.dish} — <span style={{ color: '#6b7280' }}>{item.family}</span>
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

export const template = {
  component: GuestListReminderEmail,
  subject: (data: Record<string, any>) =>
    data.eventTitle
      ? `Guest List: ${data.eventTitle} — ${data.totalHeadcount || 0} attending`
      : 'Guest List Reminder',
  displayName: 'Guest list reminder (2h before event)',
  previewData: {
    recipientName: 'Ahmed',
    eventTitle: 'Friday Gathering',
    eventDate: 'Friday, January 15, 2026 at 7:00 PM',
    eventLocation: 'Community Hall',
    totalHeadcount: 42,
    totalAdults: 25,
    totalElders: 5,
    totalChildren: 12,
    guestList: [
      { name: 'Ahmed', family: 'Abushousha', adults: 2, children: 3, elders: 1 },
      { name: 'Fatima', family: 'Al-Hassan', adults: 1, children: 0, elders: 0 },
    ],
    potluckItems: [
      { dish: 'Hummus', family: 'Abushousha' },
      { dish: 'Biryani', family: 'Al-Hassan' },
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
