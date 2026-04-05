/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
  token?: string
}

const LOGO_URL = 'https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/email-logo.png'

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
  token,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{token ? `Your ${siteName} login code is ${token}` : `Your sign-in link for ${siteName}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={`${siteName} logo`} width="64" height="64" style={logo} />
        <Heading style={h1}>{token ? 'Enter your 6-digit code' : 'Your sign-in link'}</Heading>
        <Text style={text}>
          {token
            ? `We generated a one-time code for your ${siteName} login. Enter it in the app to continue.`
            : `Tap below to sign in to ${siteName}. This link will expire shortly.`}
        </Text>
        {token ? (
          <Text style={codeLabel}>Your verification code</Text>
        ) : null}
        {token ? <Text style={codeBox}>{token}</Text> : null}
        {token ? (
          <Text style={helperText}>
            If the code doesn't work, you can still use the secure sign-in link below.
          </Text>
        ) : null}
        <Button style={button} href={confirmationUrl}>
          {token ? 'Open secure sign-in link' : 'Sign In'}
        </Button>
        <Text style={footer}>
          If you didn't request this link, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '30px 25px', maxWidth: '480px', margin: '0 auto' }
const logo = { margin: '0 0 20px' }
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
  margin: '0 0 25px',
}
const codeLabel = {
  fontSize: '13px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase' as const,
  color: 'hsl(150, 10%, 45%)',
  margin: '0 0 10px',
}
const codeBox = {
  backgroundColor: 'hsl(40, 25%, 94%)',
  border: '1px solid hsl(40, 20%, 85%)',
  borderRadius: '0.75rem',
  color: 'hsl(150, 25%, 15%)',
  fontFamily: "'Inter', Arial, sans-serif",
  fontSize: '32px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.35em',
  lineHeight: '1',
  margin: '0 0 18px',
  padding: '18px 20px 18px 28px',
  textAlign: 'center' as const,
}
const helperText = {
  fontSize: '13px',
  color: 'hsl(150, 10%, 45%)',
  lineHeight: '1.6',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: 'hsl(153, 40%, 28%)',
  color: 'hsl(40, 33%, 96%)',
  fontSize: '15px',
  borderRadius: '0.75rem',
  padding: '14px 24px',
  textDecoration: 'none',
  fontWeight: 'bold' as const,
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
