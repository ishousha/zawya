import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
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
        <Heading style={h1}>Membership Update</Heading>
        <Text style={text}>
          {memberName ? `Dear ${memberName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={text}>
          We regret to inform you that your membership access has been
          set to <strong>pending</strong> by an admin. This may be temporary
          while your registration is reviewed.
        </Text>
        <Text style={text}>
          If you believe this is in error, please reach out to a community
          admin for assistance.
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
  component: UserRejectedEmail,
  subject: `Update on your ${SITE_NAME} membership`,
  displayName: 'User rejected/revoked notification',
  previewData: { memberName: 'Ahmed' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 24px', maxWidth: '480px', margin: '0 auto' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#b91c1c', margin: '0 0 20px', fontFamily: "'Playfair Display', Georgia, serif" }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#9ca3af', margin: '0' }
