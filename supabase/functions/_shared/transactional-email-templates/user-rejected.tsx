import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface UserRejectedProps {
  memberName?: string
}

const UserRejectedEmail = ({ memberName }: UserRejectedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Update on your {SITE_NAME} membership request</Preview>
    <Body style={main}>
      <Container style={container}>
        {/* Decorative header bar */}
        <Section style={headerBar} />

        <Heading style={h1}>Membership Update</Heading>

        <Text style={greeting}>
          {memberName ? `Assalamu Alaikum ${memberName},` : 'Assalamu Alaikum,'}
        </Text>

        <Text style={text}>
          We regret to inform you that your membership access has been
          set to <strong style={{ color: '#b91c1c' }}>pending review</strong> by a community admin.
        </Text>

        <Section style={infoBox}>
          <Text style={infoItem}>ℹ️ This may be temporary while your registration is reviewed</Text>
          <Text style={infoItem}>ℹ️ Your account data remains safe and unchanged</Text>
          <Text style={infoItem}>ℹ️ You will be notified if your status is updated</Text>
        </Section>

        <Text style={text}>
          If you believe this is in error, please reach out to a community
          admin for assistance.
        </Text>

        <Hr style={hr} />

        <Text style={footer}>
          We appreciate your understanding and patience.
        </Text>
        <Text style={signoff}>
          — The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: UserRejectedEmail,
  subject: `Update on your ${SITE_NAME} membership`,
  displayName: 'User rejected/revoked notification',
  previewData: { memberName: 'Ahmed' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '0 24px 32px', maxWidth: '480px', margin: '0 auto' }
const headerBar = { backgroundColor: '#b91c1c', height: '6px', borderRadius: '0 0 4px 4px', marginBottom: '28px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#b91c1c', margin: '0 0 24px', fontFamily: "'Playfair Display', Georgia, serif", textAlign: 'center' as const }
const greeting = { fontSize: '16px', color: '#374151', lineHeight: '1.6', margin: '0 0 8px', fontWeight: '600' as const }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const infoBox = { backgroundColor: '#fef2f2', borderRadius: '8px', padding: '16px 20px', margin: '0 0 24px' }
const infoItem = { fontSize: '14px', color: '#991b1b', lineHeight: '1.5', margin: '0 0 6px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 8px' }
const signoff = { fontSize: '13px', color: '#9ca3af', margin: '0' }
