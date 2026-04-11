import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface UserApprovedProps {
  memberName?: string
}

const UserApprovedEmail = ({ memberName }: UserApprovedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} membership has been approved — welcome to the community!</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Decorative header bar */}
        <Section style={headerBar} />

        <Heading style={h1}>Welcome to {SITE_NAME}! 🌿</Heading>

        <Text style={greeting}>
          {memberName ? `Assalamu Alaikum ${memberName},` : 'Assalamu Alaikum,'}
        </Text>

        <Text style={text}>
          Great news — your membership has been <strong style={{ color: '#2d6a4f' }}>approved</strong> by our community admins.
        </Text>

        <Text style={text}>
          You now have full access to:
        </Text>

        <Section style={featureList}>
          <Text style={featureItem}>✅ Browse and RSVP for upcoming events</Text>
          <Text style={featureItem}>✅ Coordinate potluck dishes with the community</Text>
          <Text style={featureItem}>✅ Invite guests and manage your family</Text>
          <Text style={featureItem}>✅ Receive event reminders and updates</Text>
        </Section>

        <Section style={ctaSection}>
          <Button style={ctaButton} href="https://zawya.lovable.app">
            Open {SITE_NAME} →
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          We're glad to have you in the community. If you have any questions, don't hesitate to reach out to a community admin.
        </Text>
        <Text style={signoff}>
          — The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: UserApprovedEmail,
  subject: `You're approved — Welcome to ${SITE_NAME}!`,
  displayName: 'User approved notification',
  previewData: { memberName: 'Ahmed' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '0 24px 32px', maxWidth: '480px', margin: '0 auto' }
const headerBar = { backgroundColor: '#2d6a4f', height: '6px', borderRadius: '0 0 4px 4px', marginBottom: '28px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#2d6a4f', margin: '0 0 24px', fontFamily: "'Playfair Display', Georgia, serif", textAlign: 'center' as const }
const greeting = { fontSize: '16px', color: '#374151', lineHeight: '1.6', margin: '0 0 8px', fontWeight: '600' as const }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const featureList = { backgroundColor: '#f0fdf4', borderRadius: '8px', padding: '16px 20px', margin: '0 0 24px' }
const featureItem = { fontSize: '14px', color: '#15803d', lineHeight: '1.5', margin: '0 0 6px' }
const ctaSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const ctaButton = { backgroundColor: '#2d6a4f', color: '#ffffff', fontSize: '16px', fontWeight: '600' as const, padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 8px' }
const signoff = { fontSize: '13px', color: '#9ca3af', margin: '0' }
