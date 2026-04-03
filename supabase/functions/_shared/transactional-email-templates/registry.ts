/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as contactConfirmation } from './contact-confirmation.tsx'
import { template as contactAdminNotification } from './contact-admin-notification.tsx'
import { template as subscriptionWelcome } from './subscription-welcome.tsx'
import { template as subscriptionCancelled } from './subscription-cancelled.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'contact-confirmation': contactConfirmation,
  'contact-admin-notification': contactAdminNotification,
  'subscription-welcome': subscriptionWelcome,
  'subscription-cancelled': subscriptionCancelled,
}
