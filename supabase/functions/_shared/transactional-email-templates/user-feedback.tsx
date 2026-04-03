import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = "Thirsty Grass"

interface UserFeedbackProps {
  userEmail?: string
  zipCode?: string
  grassType?: string
  irrigationType?: string
  tier?: string
  recommendation?: string
  recommendationReason?: string
  message?: string
  sentAt?: string
}

const UserFeedbackEmail = ({
  userEmail = 'unknown',
  zipCode = 'N/A',
  grassType = 'N/A',
  irrigationType = 'N/A',
  tier = 'free',
  recommendation = 'N/A',
  recommendationReason = 'N/A',
  message = '',
  sentAt = '',
}: UserFeedbackProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>User Feedback from {userEmail}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>{SITE_NAME} — User Feedback</Heading>
        <Text style={text}><strong>From:</strong> {userEmail}</Text>
        <Text style={text}><strong>ZIP Code:</strong> {zipCode}</Text>
        <Text style={text}><strong>Grass Type:</strong> {grassType}</Text>
        <Text style={text}><strong>Irrigation Type:</strong> {irrigationType}</Text>
        <Text style={text}><strong>Account Tier:</strong> {tier}</Text>
        <Text style={text}><strong>Current Recommendation:</strong> {recommendation}</Text>
        <Text style={text}><strong>Recommendation Reason:</strong> {recommendationReason}</Text>
        <Hr style={hr} />
        <Text style={text}><strong>User message:</strong></Text>
        <Text style={text}>{message}</Text>
        <Hr style={hr} />
        <Text style={footer}>Sent: {sentAt}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: UserFeedbackEmail,
  subject: (data: Record<string, any>) =>
    `ThirstyGrass Feedback — ${data.userEmail || 'Unknown user'}`,
  to: 'admin@110labs.com',
  displayName: 'User feedback',
  previewData: {
    userEmail: 'user@example.com',
    zipCode: '02101',
    grassType: 'Cool-Season (Kentucky Bluegrass)',
    irrigationType: 'Sprinkler',
    tier: 'free',
    recommendation: 'WATER',
    recommendationReason: "Your lawn needs water.",
    message: "It says WATER but it's been raining all week...",
    sentAt: '4/3/2026, 10:00:00 AM',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#000000', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 8px' }
const hr = { borderColor: '#e5e5e5', margin: '16px 0' }
const footer = { fontSize: '12px', color: '#999999', margin: '16px 0 0' }
