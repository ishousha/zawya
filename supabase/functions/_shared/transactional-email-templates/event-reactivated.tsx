import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface EventReactivatedProps {
  eventTitle?: string
  eventDate?: string
  memberName?: string
}

const EventReactivatedEmail = ({ eventTitle, eventDate, memberName }: EventReactivatedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{eventTitle ? `${eventTitle} is back on!` : 'An event has been reactivated'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Event is Back On!</Heading>
        <Text style={text}>
          {memberName ? `Dear ${memberName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={text}>
          Great news! <strong>{eventTitle || 'An event'}</strong>
          {eventDate ? ` on ${eventDate}` : ''} has been reactivated.
        </Text>
        <Text style={text}>
          Your existing RSVP is still valid — no need to re-register. We look forward to seeing you there!
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          — The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EventReactivatedEmail,
  subject: (data: Record<string, any>) =>
    data.eventTitle ? `Back On: ${data.eventTitle}` : 'Event Reactivated',
  displayName: 'Event reactivated notification',
  previewData: { eventTitle: 'Friday Gathering', eventDate: 'January 15, 2026', memberName: 'Ahmed' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#2d6a4f', margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
