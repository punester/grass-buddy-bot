import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "ThirstyGrass"

interface SubscriptionWelcomeProps {
  name?: string
}

const SubscriptionWelcomeEmail = ({ name }: SubscriptionWelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} Pro!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={logo}>🌱 {SITE_NAME}</Text>
        <Heading style={h1}>
          {name ? `Welcome aboard, ${name}!` : 'Welcome to ThirstyGrass Pro!'}
        </Heading>
        <Text style={text}>
          Your Pro subscription is now active. Here's what you've unlocked:
        </Text>
        <Text style={feature}>✅ Daily SMS watering alerts</Text>
        <Text style={feature}>✅ 7-day forecast with detailed analysis</Text>
        <Text style={feature}>✅ Soil-type watering adjustments</Text>
        <Text style={feature}>✅ Seasonal lawn care tips</Text>
        <Text style={text}>
          Your lawn is about to get a lot happier. We'll keep you posted with smart, data-driven watering advice all season long.
        </Text>
        <Button style={button} href="https://grass-buddy-bot.lovable.app/dashboard">
          Go to your Dashboard
        </Button>
        <Text style={footer}>Thanks for supporting {SITE_NAME}!{'\n'}The {SITE_NAME} Team</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: SubscriptionWelcomeEmail,
  subject: 'Welcome to ThirstyGrass Pro! 🌱',
  displayName: 'Subscription welcome',
  previewData: { name: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 25px' }
const logo = { fontSize: '16px', fontWeight: 'bold' as const, color: '#16a34a', margin: '0 0 24px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#1a1a1a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const feature = { fontSize: '14px', color: '#1a1a1a', lineHeight: '1.6', margin: '0 0 4px', paddingLeft: '4px' }
const button = { backgroundColor: '#16a34a', color: '#ffffff', padding: '12px 24px', borderRadius: '6px', fontSize: '14px', fontWeight: 'bold' as const, textDecoration: 'none', display: 'inline-block', margin: '16px 0 24px' }
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0', whiteSpace: 'pre-line' as const }
