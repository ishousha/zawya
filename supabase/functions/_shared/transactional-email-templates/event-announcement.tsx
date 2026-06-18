/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Img, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Zawya'

interface EventAnnouncementProps {
  memberName?: string
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  eventType?: string
  hostName?: string
  description?: string
  coverPhotoUrl?: string
  eventUrl?: string
}

const EventAnnouncementEmail = ({
  memberName,
  eventTitle = 'New Community Event',
  eventDate = '',
  eventLocation = '',
  eventType = '',
  hostName = '',
  description = '',
  coverPhotoUrl = '',
  eventUrl = 'https://zawya.app',
}: EventAnnouncementProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New event: {eventTitle}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>You're invited ✨</Heading>
        <Text style={text}>
          {memberName ? `Assalamu Alaikum ${memberName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={text}>
          A new gathering has been added to {SITE_NAME}. We'd love to see you there inshaAllah.
        </Text>

        {coverPhotoUrl ? (
          <Img src={coverPhotoUrl} alt={eventTitle} width="432" style={cover} />
        ) : null}

        <Section style={detailsBox}>
          <Text style={detailLabel}>Event</Text>
          <Text style={detailValue}>{eventTitle}</Text>

          {eventType ? (
            <>
              <Text style={detailLabel}>Type</Text>
              <Text style={detailValue}>{eventType}</Text>
            </>
          ) : null}

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

          {hostName ? (
            <>
              <Text style={detailLabel}>Host</Text>
              <Text style={detailValue}>{hostName}</Text>
            </>
          ) : null}
        </Section>

        {description ? <Text style={text}>{description}</Text> : null}

        <Section style={{ textAlign: 'center', margin: '24px 0' }}>
          <Button href={eventUrl} style={button}>View & RSVP</Button>
        </Section>

        <Hr style={hr} />
        <Text style={footer}>— The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EventAnnouncementEmail,
  subject: (data: Record<string, any>) => `New event: ${data.eventTitle || 'Community gathering'}`,
  displayName: 'New event announcement',
  previewData: {
    memberName: 'Ahmed',
    eventTitle: 'Friday Gathering',
    eventDate: 'Friday, January 10 at 7:00 PM',
    eventLocation: 'Community Hall',
    eventType: 'Physical',
    hostName: 'Shaykh Yusuf',
    description: 'Join us for an evening of dhikr and reflection.',
    eventUrl: 'https://zawya.app/event/ABC123',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#2d6a4f', margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const cover = { width: '100%', height: 'auto', borderRadius: '8px', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
const detailsBox = { backgroundColor: '#f9fafb', borderRadius: '8px', padding: '16px 20px', margin: '0 0 16px' }
const detailLabel = { fontSize: '11px', color: '#9ca3af', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 2px', fontWeight: 'bold' as const }
const detailValue = { fontSize: '15px', color: '#374151', margin: '0 0 12px' }
const button = { backgroundColor: '#2d6a4f', color: '#ffffff', padding: '12px 28px', borderRadius: '8px', textDecoration: 'none', fontSize: '15px', fontWeight: 'bold' as const, display: 'inline-block' }
