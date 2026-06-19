/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface SignUpItem {
  itemName: string
  quantity: number
  description?: string | null
}

interface EventReminderProps {
  memberName?: string
  eventTitle?: string
  eventDate?: string
  eventLocation?: string
  reminderType?: '24h' | '12h' | '2h'
  signUpItems?: SignUpItem[]
  potluckItem?: string
}

const EventReminderEmail = ({
  memberName,
  eventTitle = 'Community Event',
  eventDate = '',
  eventLocation = '',
  reminderType = '24h',
  signUpItems = [],
  potluckItem,
}: EventReminderProps) => {
  const hasBringList = signUpItems.length > 0 || !!potluckItem
  const timeLabel = reminderType === '2h' ? '2 hours' : reminderType === '12h' ? '12 hours' : '24 hours'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{eventTitle} starts in {timeLabel}!</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Reminder — {timeLabel} to go! ⏰</Heading>
          <Text style={text}>
            {memberName ? `Assalamu Alaikum ${memberName},` : 'Assalamu Alaikum,'}
          </Text>
          <Text style={text}>
            Just a friendly reminder that <strong>{eventTitle}</strong> is starting in {timeLabel}. We hope to see you there inshaAllah!
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
          </Section>

          {hasBringList ? (
            <Section style={bringBox}>
              <Text style={bringLabel}>Don't forget to bring</Text>
              {signUpItems.length > 0 ? (
                signUpItems.map((item, i) => (
                  <Text key={i} style={bringItem}>
                    • {item.itemName}{item.quantity > 1 ? ` ×${item.quantity}` : ''}
                    {item.description ? ` — ${item.description}` : ''}
                  </Text>
                ))
              ) : (
                <Text style={bringItem}>• {potluckItem}</Text>
              )}
            </Section>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>— The {SITE_NAME} Team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventReminderEmail,
  subject: (data: Record<string, any>) => {
    const t = data.reminderType === '2h' ? '2 hours' : '24 hours'
    return `Reminder: ${data.eventTitle || 'Event'} starts in ${t}`
  },
  displayName: 'Event reminder',
  previewData: {
    memberName: 'Ahmed',
    eventTitle: 'Friday Gathering',
    eventDate: 'Friday, January 10 at 7:00 PM',
    eventLocation: 'Community Hall',
    reminderType: '2h',
    signUpItems: [
      { itemName: 'Karak', quantity: 2 },
      { itemName: 'Dessert', quantity: 1, description: 'Baklava' },
    ],
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
const bringBox = { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '14px 18px', margin: '0 0 16px' }
const bringLabel = { fontSize: '11px', color: '#166534', textTransform: 'uppercase' as const, letterSpacing: '0.05em', margin: '0 0 6px', fontWeight: 'bold' as const }
const bringItem = { fontSize: '15px', color: '#166534', margin: '0 0 4px', lineHeight: '1.5' }
