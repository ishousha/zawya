import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Hr, Section,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface NewMemberPendingProps {
  memberName?: string
  memberEmail?: string
  memberPhone?: string
}

const NewMemberPendingEmail = ({ memberName, memberEmail, memberPhone }: NewMemberPendingProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New member awaiting approval on {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={headerBar} />

        <Heading style={h1}>New Member Request 🔔</Heading>

        <Text style={text}>
          A new member has signed up and is awaiting your approval.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailItem}>
            <strong>Name:</strong> {memberName || 'Not provided'}
          </Text>
          <Text style={detailItem}>
            <strong>Email:</strong> {memberEmail || 'Not provided'}
          </Text>
          {memberPhone && (
            <Text style={detailItem}>
              <strong>WhatsApp:</strong> {memberPhone}
            </Text>
          )}
        </Section>

        <Section style={ctaSection}>
          <Button style={ctaButton} href="https://zawya.lovable.app/admin">
            Review in Admin Dashboard →
          </Button>
        </Section>

        <Hr style={hr} />

        <Text style={footer}>
          You're receiving this because you are an admin of {SITE_NAME}.
        </Text>
        <Text style={signoff}>
          — {SITE_NAME} System
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewMemberPendingEmail,
  subject: (data: Record<string, any>) =>
    `New member pending approval: ${data?.memberName || 'Unknown'}`,
  displayName: 'New member pending approval (admin notification)',
  previewData: { memberName: 'Ahmed Hassan', memberEmail: 'ahmed@example.com', memberPhone: '+971501234567' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '0 24px 32px', maxWidth: '480px', margin: '0 auto' }
const headerBar = { backgroundColor: '#b8860b', height: '6px', borderRadius: '0 0 4px 4px', marginBottom: '28px' }
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#2d6a4f', margin: '0 0 24px', fontFamily: "'Playfair Display', Georgia, serif", textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox = { backgroundColor: '#fef9e7', borderRadius: '8px', padding: '16px 20px', margin: '0 0 24px', border: '1px solid #f0e6c0' }
const detailItem = { fontSize: '14px', color: '#374151', lineHeight: '1.5', margin: '0 0 6px' }
const ctaSection = { textAlign: 'center' as const, margin: '0 0 24px' }
const ctaButton = { backgroundColor: '#2d6a4f', color: '#ffffff', fontSize: '16px', fontWeight: '600' as const, padding: '14px 32px', borderRadius: '8px', textDecoration: 'none', display: 'inline-block' }
const hr = { borderColor: '#e5e7eb', margin: '24px 0' }
const footer = { fontSize: '13px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 8px' }
const signoff = { fontSize: '13px', color: '#9ca3af', margin: '0' }
