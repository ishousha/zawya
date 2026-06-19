/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface GuestApprovedProps {
  guestName?: string
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  eventAddress?: string
  mapUrl?: string
  eventLink?: string
  requestedBy?: string
}

const GuestApprovedEmail = ({
  guestName = 'Guest',
  eventTitle = 'Community Event',
  eventDate = '',
  eventLocation = '',
  eventAddress = '',
  mapUrl = '',
  eventLink = '',
  requestedBy = '',
}: GuestApprovedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're invited to {eventTitle} — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're Invited! 🎉</Heading>
        <Text style={text}>
          Assalamu Alaikum {guestName},
        </Text>
        <Text style={text}>
          Great news — your guest request for <strong>{eventTitle}</strong> has been
          approved{requestedBy ? ` (requested by ${requestedBy})` : ''}.
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
              {eventAddress ? (
                <Text style={addressLine}>{eventAddress}</Text>
              ) : null}
              {mapUrl ? (
                <>
                  <Button href={mapUrl} style={mapButton}>
                    View on Google Maps
                  </Button>
                  <Text style={mapFallback}>
                    Or open this link: <a href={mapUrl} style={{ color: '#2d6a4f' }}>{mapUrl}</a>
                  </Text>
                </>
              ) : null}
            </>
          ) : null}

          {eventLink ? (
            <>
              <Text style={detailLabel}>Online Link</Text>
              <Text style={detailValue}>
                <a href={eventLink} style={{ color: '#2d6a4f' }}>{eventLink}</a>
              </Text>
            </>
          ) : null}
        </Section>

        <Text style={text}>
          We look forward to seeing you there inshaAllah!
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
  component: GuestApprovedEmail,
  subject: (data: Record<string, any>) =>
    `You're invited to ${data.eventTitle || 'an event'} — ${SITE_NAME}`,
  displayName: 'Guest approved — event invitation',
  previewData: {
    guestName: 'Fatima',
    eventTitle: 'Friday Gathering',
    eventDate: 'Friday, January 10 at 7:00 PM',
    eventLocation: 'Community Hall',
    eventAddress: '123 Main St, Dubai',
    mapUrl: 'https://www.google.com/maps/search/?api=1&query=Community+Hall+123+Main+St+Dubai',
    requestedBy: 'Ahmed',
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
const detailValue = { fontSize: '15px', color: '#374151', margin: '0 0 4px' }
const addressLine = { fontSize: '14px', color: '#6b7280', margin: '0 0 10px', lineHeight: '1.5' }
const mapButton = { backgroundColor: '#2d6a4f', color: '#ffffff', padding: '10px 18px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block', margin: '4px 0 8px' }
const mapFallback = { fontSize: '11px', color: '#9ca3af', margin: '0 0 12px', wordBreak: 'break-all' as const }
