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
  Link,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  token?: string
}

const LOGO_URL = 'https://ikzaalswkajtaxejyskw.supabase.co/storage/v1/object/public/event-covers/email-logo.png'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  token,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {siteName} — confirm your email</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt={`${siteName} logo`} width="64" height="64" style={logo} />
        <Heading style={h1}>Welcome to the community</Heading>
        <Text style={text}>
          Assalamu Alaikum! Thanks for joining{' '}
          <Link href={siteUrl} style={link}>
            <strong>{siteName}</strong>
          </Link>
          .
        </Text>
        <Text style={text}>
          Please confirm your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) using one of the methods below:
        </Text>

        {token && (
          <Section style={otpSection}>
            <Text style={otpLabel}>Your verification code:</Text>
            <Text style={otpCode}>{token}</Text>
            <Text style={otpHint}>Enter this code on the verification screen</Text>
          </Section>
        )}

        <Text style={orDivider}>— or —</Text>

        <Button style={button} href={confirmationUrl}>
          Confirm via Link
        </Button>

        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

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
const link = { color: 'hsl(153, 40%, 28%)', textDecoration: 'underline' }
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
const otpSection = {
  backgroundColor: 'hsl(40, 33%, 96%)',
  borderRadius: '12px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '0 0 20px',
}
const otpLabel = {
  fontSize: '13px',
  color: 'hsl(150, 10%, 45%)',
  margin: '0 0 8px',
  textAlign: 'center' as const,
}
const otpCode = {
  fontSize: '32px',
  fontWeight: 'bold' as const,
  letterSpacing: '6px',
  color: 'hsl(150, 25%, 15%)',
  margin: '0 0 8px',
  textAlign: 'center' as const,
  fontFamily: "'Courier New', monospace",
}
const otpHint = {
  fontSize: '12px',
  color: 'hsl(150, 10%, 55%)',
  margin: '0',
  textAlign: 'center' as const,
}
const orDivider = {
  fontSize: '13px',
  color: '#999999',
  textAlign: 'center' as const,
  margin: '0 0 20px',
}
