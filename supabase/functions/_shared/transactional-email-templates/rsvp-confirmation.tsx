/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface RsvpConfirmationProps {
  memberName?: string
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  guestsCount?: number
  isWaitlisted?: boolean
}

const RsvpConfirmationEmail = ({
  memberName,
  eventTitle = 'Community Event',
  eventDate = '',
  eventLocation = '',
  guestsCount = 1,
  isWaitlisted = false,
}: RsvpConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {isWaitlisted
        ? `You're on the waitlist for ${eventTitle}`
        : `Your RSVP for ${eventTitle} is confirmed!`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>
          {isWaitlisted ? 'Waitlisted 📋' : 'RSVP Confirmed ✅'}
        </Heading>
        <Text style={text}>
          {memberName ? `Assalamu Alaikum ${memberName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={text}>
          {isWaitlisted
            ? `You've been added to the waitlist for **${eventTitle}**. We'll notify you if a spot opens up inshaAllah.`
            : `Your RSVP for **${eventTitle}** has been confirmed. We look forward to seeing you!`}
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>Event</Text>
          <Text style={detailValue}>{eventTitle}</Text>

          {eventDate ? (
            <>
              <Text style={detailLabel}>Date & Time</Text>
              <Text style={detailValue}>{eventDate}</Text>
            </>
          ) : null}

          {eventLocation ? (
            <>
              <Text style={detailLabel}>Location</Text>
              <Text style={detailValue}>{eventLocation}</Text>
            </>
          ) : null}

          <Text style={detailLabel}>Party Size</Text>
          <Text style={detailValue}>{guestsCount} {guestsCount === 1 ? 'person' : 'people'}</Text>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: RsvpConfirmationEmail,
  subject: (data: Record<string, any>) =>
    data.isWaitlisted
      ? `Waitlisted — ${data.eventTitle || 'Event'}`
      : `RSVP Confirmed — ${data.eventTitle || 'Event'}`,
  displayName: 'RSVP confirmation',
  previewData: {
    memberName: 'Ahmed',
    eventTitle: 'Friday Gathering',
    eventDate: 'Friday, January 10 at 7:00 PM',
    eventLocation: 'Community Hall',
    guestsCount: 3,
    isWaitlisted: false,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#2d6a4f', margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
const detailsBox = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px 20px', margin: '0 0 16px' }
const detailLabel = { fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px', fontWeight: 'bold' as const }
const detailValue = { fontSize: '15px', color: '#374151', margin: '0 0 12px' }
