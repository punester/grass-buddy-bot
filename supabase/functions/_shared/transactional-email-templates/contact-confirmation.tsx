import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ThirstyGrass"

interface ContactConfirmationProps {
  name?: string
}

const ContactConfirmationEmail = ({ name }: ContactConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Thanks for reaching out to {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🌱 {SITE_NAME}</Text>
        <Heading style={h1}>
          {name ? `Thank you, ${name}!` : 'Thank you for reaching out!'}
        </Heading>
        <Text style={text}>
          We've received your message and will get back to you within 1–2 business days.
        </Text>
        <Text style={footer}>Best regards,{'\n'}The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactConfirmationEmail,
  subject: 'Thanks for contacting ThirstyGrass',
  displayName: 'Contact confirmation',
  previewData: { name: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px' }
const logo = { fontSize: '16px', fontWeight: 'bold' as const, color: '#16a34a', margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0', whiteSpace: 'pre-line' as const }
