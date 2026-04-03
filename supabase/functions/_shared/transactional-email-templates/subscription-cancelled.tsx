import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ThirstyGrass"

interface SubscriptionCancelledProps {
  name?: string
  endsAt?: string
}

const SubscriptionCancelledEmail = ({ name, endsAt }: SubscriptionCancelledProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your {SITE_NAME} Pro subscription has been cancelled</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🌱 {SITE_NAME}</Text>
        <Heading style={h1}>
          {name ? `We're sorry to see you go, ${name}` : "We're sorry to see you go"}
        </Heading>
        <Text style={text}>
          Your ThirstyGrass Pro subscription has been cancelled.
          {endsAt ? ` You'll continue to have Pro access until ${endsAt}.` : ''}
        </Text>
        <Text style={text}>
          After that, your account will revert to the free tier. You'll still be able to check basic watering recommendations by ZIP code.
        </Text>
        <Text style={text}>
          If you change your mind, you can resubscribe anytime from your dashboard.
        </Text>
        <Button style={button} href="https://grass-buddy-bot.lovable.app/pricing">
          View Plans
        </Button>
        <Text style={footer}>We hope to see you back soon.{'\n'}The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionCancelledEmail,
  subject: 'Your ThirstyGrass Pro subscription has been cancelled',
  displayName: 'Subscription cancelled',
  previewData: { name: 'Jane', endsAt: 'January 15, 2025' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px' }
const logo = { fontSize: '16px', fontWeight: 'bold' as const, color: '#16a34a', margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const button = { backgroundColor: '#16a34a', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block', margin: '16px 0 24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0', whiteSpace: 'pre-line' as const }
