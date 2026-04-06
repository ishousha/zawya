import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Zawya"

interface FamilyMemberLeftProps {
  memberName?: string
  leaverName?: string
  familyName?: string
}

const FamilyMemberLeftEmail = ({ memberName, leaverName, familyName }: FamilyMemberLeftProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{leaverName || 'A member'} has left {familyName || 'your family group'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Family Update</Heading>
        <Text style={text}>
          {memberName ? `Assalamu Alaikum ${memberName},` : 'Assalamu Alaikum,'}
        </Text>
        <Text style={text}>
          <strong>{leaverName || 'A member'}</strong> has left{' '}
          <strong>{familyName || 'your family group'}</strong> on {SITE_NAME}.
        </Text>
        <Text style={text}>
          If this was unexpected, you can reach out to them directly. Your family group
          and all existing RSVPs remain unchanged.
        </Text>
        <Hr style={hr} />
        <Text style={footer}>
          This is an automated notification from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: FamilyMemberLeftEmail,
  subject: (data) => `${data.leaverName || 'A member'} left your family group`,
  displayName: 'Family Member Left',
  previewData: {
    memberName: 'Ahmad',
    leaverName: 'Sarah',
    familyName: 'Ahmad Family',
  },
}

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '480px', margin: '0 auto' }
const h1 = {
  fontFamily: "'Playfair Display', Georgia, serif",
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(150, 25%, 15%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(150, 10%, 45%)',
  lineHeight: '1.6',
  margin: '0 0 15px',
}
const hr = { borderColor: 'hsl(40, 20%, 85%)', margin: '25px 0' }
const footer = { fontSize: '12px', color: '#999999' }
