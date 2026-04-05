import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface EventCancelledProps {
  eventTitle?: string
  eventDate?: string
  memberName?: string
}

const EventCancelledEmail = ({ eventTitle, eventDate, memberName }: EventCancelledProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{eventTitle ? `${eventTitle} has been cancelled` : 'An event has been cancelled'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Event Cancelled</Heading>
        <Text style={text}>
          {memberName ? `Dear ${memberName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={text}>
          We regret to inform you that <strong>{eventTitle || 'an event'}</strong>
          {eventDate ? ` scheduled for ${eventDate}` : ''} has been cancelled.
        </Text>
        <Text style={text}>
          Your RSVP has been noted and no further action is needed from your side.
          We apologize for any inconvenience.
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
  component: EventCancelledEmail,
  subject: (data: Record<string, any>) =>
    data.eventTitle ? `Cancelled: ${data.eventTitle}` : 'Event Cancelled',
  displayName: 'Event cancelled notification',
  previewData: { eventTitle: 'Friday Gathering', eventDate: 'January 15, 2026', memberName: 'Ahmed' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#b91c1c', margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
