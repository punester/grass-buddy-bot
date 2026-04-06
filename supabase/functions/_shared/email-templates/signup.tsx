/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Hr,
  Preview,
  Section,
  Text,
  Row,
  Column,
} from 'npm:@react-email/components@0.0.22'

interface WeatherData {
  address?: string
  recommendation?: 'WATER' | 'MONITOR' | 'SKIP'
  recommendationReason?: string
  precipitation?: { day1: number; day3: number; day5: number }
  forecast?: { day1: number; day3: number; day5: number; recommendedWateringDay: number }
  lastUpdated?: string
  etLoss7d?: number
  weeklyNeed?: number
  deficit?: number
  grassType?: string
  seasonalAlert?: string
  seasonalMessage?: string
}

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
  weatherData?: WeatherData
}

const formatInches = (val: number | undefined) => (val ?? 0).toFixed(2)

const getRecommendationColor = (rec: string, seasonalAlert?: string) => {
  if (seasonalAlert === 'FROST_INCOMING' || seasonalAlert === 'WINTERIZE') return '#3b82f6'
  switch (rec) {
    case 'SKIP': return '#16a34a'
    case 'MONITOR': return '#d97706'
    case 'WATER': return '#dc2626'
    default: return '#6b7280'
  }
}

const getDisplayLabel = (rec: string, seasonalAlert?: string) => {
  if (seasonalAlert === 'FROST_INCOMING') return '❄️ Frost Alert — Skip Watering'
  if (seasonalAlert === 'WINTERIZE') return '🧊 Winterize — Skip Watering'
  switch (rec) {
    case 'SKIP': return '✅ Skip Watering'
    case 'MONITOR': return '⚠️ Monitor'
    case 'WATER': return '🔴 Water Now'
    default: return rec
  }
}

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
  weatherData,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {weatherData?.recommendation
        ? `${weatherData.recommendation}: ${weatherData.recommendationReason}`
        : 'Confirm your email for ThirstyGrass'}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={brand}>🌱 ThirstyGrass</Text>

        {weatherData?.recommendation && (
          <>
            <Section style={{
              ...recommendationBanner,
              backgroundColor: getRecommendationColor(weatherData.recommendation),
            }}>
              <Text style={recommendationIcon}>
                {weatherData.recommendation === 'SKIP' ? '✅' : weatherData.recommendation === 'MONITOR' ? '⚠️' : '🔴'}
              </Text>
              <Heading style={recommendationHeading}>{weatherData.recommendation}</Heading>
              {weatherData.lastUpdated && (
                <Text style={recommendationDate}>Last updated: {weatherData.lastUpdated}</Text>
              )}
            </Section>

            <Text style={recommendationText}>
              {weatherData.recommendationReason}
            </Text>

            {weatherData.precipitation && weatherData.forecast && (
              <Section style={dataSection}>
                <Row>
                  <Column style={dataColumn}>
                    <Text style={dataHeader}>HISTORICAL PRECIPITATION</Text>
                    <Text style={dataRow}>Last 24 hours: <strong>{formatInches(weatherData.precipitation.day1)}"</strong></Text>
                    <Text style={dataRow}>Last 3 days: <strong>{formatInches(weatherData.precipitation.day3)}"</strong></Text>
                    <Text style={dataRow}>Last 5 days: <strong>{formatInches(weatherData.precipitation.day5)}"</strong></Text>
                  </Column>
                  <Column style={dataColumn}>
                    <Text style={dataHeader}>PRECIPITATION FORECAST</Text>
                    <Text style={dataRow}>Next 24 hours: <strong>{formatInches(weatherData.forecast.day1)}"</strong></Text>
                    <Text style={dataRow}>Next 3 days: <strong>{formatInches(weatherData.forecast.day3)}"</strong></Text>
                    <Text style={dataRow}>Next 5 days: <strong>{formatInches(weatherData.forecast.day5)}"</strong></Text>
                  </Column>
                </Row>
              </Section>
            )}

            <Hr style={divider} />
          </>
        )}

        <Heading style={h1}>Verify your email to continue</Heading>
        <Text style={text}>
          View how we calculated this & access additional tools — sign in to your ThirstyGrass dashboard.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Verify Email & Open Dashboard
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px' }
const brand = { fontSize: '18px', fontWeight: 'bold' as const, color: '#3d8b4f', margin: '0 0 20px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a1628', margin: '0 0 20px' }
const text = { fontSize: '14px', color: '#6b7280', lineHeight: '1.5', margin: '0 0 25px' }
const button = {
  backgroundColor: '#3d8b4f',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '0.8rem',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }

const recommendationBanner = {
  padding: '24px 20px 20px',
  borderRadius: '12px 12px 0 0',
  textAlign: 'center' as const,
  marginBottom: '0',
}
const recommendationIcon = {
  fontSize: '32px',
  margin: '0 0 4px',
  color: '#ffffff',
}
const recommendationHeading = {
  fontSize: '28px',
  fontWeight: 'bold' as const,
  color: '#ffffff',
  margin: '0 0 4px',
}
const recommendationDate = {
  fontSize: '12px',
  color: 'rgba(255,255,255,0.8)',
  margin: '0',
}
const recommendationText = {
  fontSize: '16px',
  fontWeight: '600' as const,
  color: '#1e3a5f',
  lineHeight: '1.4',
  margin: '16px 0',
  padding: '0 4px',
}
const dataSection = {
  margin: '0 0 16px',
  padding: '12px 0',
}
const dataColumn = {
  verticalAlign: 'top' as const,
  width: '50%',
  padding: '0 8px',
}
const dataHeader = {
  fontSize: '11px',
  fontWeight: 'bold' as const,
  color: '#6b7280',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 8px',
}
const dataRow = {
  fontSize: '13px',
  color: '#374151',
  margin: '0 0 4px',
  lineHeight: '1.6',
}
const divider = {
  borderColor: '#e5e7eb',
  margin: '20px 0',
}
