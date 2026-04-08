import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface EventBroadcastProps {
  eventTitle?: string
  memberName?: string
  customSubject?: string
  customMessage?: string
}

const EventBroadcastEmail = ({ eventTitle, memberName, customMessage }: EventBroadcastProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{eventTitle ? `Important update about ${eventTitle}` : 'Important announcement'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {eventTitle ? `Update: ${eventTitle}` : 'Important Announcement'}
        </Heading>
        <Text style={text}>
          {memberName ? `Dear ${memberName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={messageText}>
          {customMessage || 'Please check the app for an important update about this event.'}
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
  component: EventBroadcastEmail,
  subject: (data: Record<string, any>) =>
    data.customSubject || (data.eventTitle ? `Update: ${data.eventTitle}` : 'Important Announcement'),
  displayName: 'Event broadcast to attendees',
  previewData: {
    eventTitle: 'Friday Gathering',
    memberName: 'Ahmed',
    customSubject: 'Venue Change — Friday Gathering',
    customMessage: 'Please note that the venue for this Friday\'s gathering has changed to the new community hall. We look forward to seeing you there!',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#166534', margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const messageText = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px', whiteSpace: 'pre-line' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
