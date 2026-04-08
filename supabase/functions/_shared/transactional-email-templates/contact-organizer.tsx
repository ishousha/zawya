import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface ContactOrganizerProps {
  eventTitle?: string
  senderName?: string
  senderEmail?: string
  messageBody?: string
}

const ContactOrganizerEmail = ({ eventTitle, senderName, senderEmail, messageBody }: ContactOrganizerProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Question about {eventTitle || 'an event'} from {senderName || 'a member'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Question About: {eventTitle || 'Event'}</Heading>
        <Text style={text}>
          <strong>{senderName || 'A community member'}</strong> ({senderEmail || 'no email'}) has a question:
        </Text>
        <Section style={messageBox}>
          <Text style={messageText}>{messageBody || '(No message provided)'}</Text>
        </Section>
        <Text style={replyHint}>
          Simply reply to this email to respond directly to {senderName || 'the member'}.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          — {SITE_NAME} Notifications
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactOrganizerEmail,
  subject: (data: Record<string, any>) =>
    `[${SITE_NAME}] Question about ${data.eventTitle || 'an event'} from ${data.senderName || 'a member'}`,
  displayName: 'Contact organizer question',
  previewData: {
    eventTitle: 'Friday Gathering',
    senderName: 'Ahmed',
    senderEmail: 'ahmed@example.com',
    messageBody: 'Assalamu Alaikum, is there parking available at the venue?',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#166534', margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const messageBox = { backgroundColor: '#f9fafb', borderLeft: '3px solid #166534', padding: '16px', borderRadius: '4px', margin: '0 0 16px' }
const messageText = { fontSize: '15px', color: '#1f2937', lineHeight: '1.6', margin: '0', whiteSpace: 'pre-line' as const }
const replyHint = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 16px', fontStyle: 'italic' as const }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
