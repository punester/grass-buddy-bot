import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ThirstyGrass"

interface ContactAdminNotificationProps {
  name?: string
  email?: string
  message?: string
}

const ContactAdminNotificationEmail = ({ name, email, message }: ContactAdminNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New contact form submission from {name || 'someone'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🌱 {SITE_NAME}</Text>
        <Heading style={h1}>New Contact Form Submission</Heading>
        <Text style={label}>Name</Text>
        <Text style={value}>{name || '(not provided)'}</Text>
        <Text style={label}>Email</Text>
        <Text style={value}>{email || '(not provided)'}</Text>
        <Hr style={hr} />
        <Text style={label}>Message</Text>
        <Text style={messageStyle}>{message || '(empty)'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: ContactAdminNotificationEmail,
  subject: (data: Record<string, any>) => `New contact form submission from ${data.name || 'someone'}`,
  to: 'hello@thirstygrass.com',
  displayName: 'Contact admin notification',
  previewData: { name: 'Jane Doe', email: 'jane@example.com', message: 'I have a question about my lawn watering schedule.' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px' }
const logo = { fontSize: '16px', fontWeight: 'bold' as const, color: '#16a34a', margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 24px' }
const label = { fontSize: '12px', color: '#999999', textTransform: 'uppercase' as const, margin: '0 0 4px', letterSpacing: '0.5px' }
const value = { fontSize: '14px', color: '#1a1a1a', margin: '0 0 16px' }
const hr = { borderColor: '#e5e5e5', margin: '16px 0' }
const messageStyle = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 24px', whiteSpace: 'pre-wrap' as const }
