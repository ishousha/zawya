/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as eventCancelled } from './event-cancelled.tsx'
import { template as eventReactivated } from './event-reactivated.tsx'
import { template as userApproved } from './user-approved.tsx'
import { template as userRejected } from './user-rejected.tsx'
import { template as familyMemberLeft } from './family-member-left.tsx'
import { template as guestApproved } from './guest-approved.tsx'
import { template as guestListReminder } from './guest-list-reminder.tsx'
import { template as rsvpConfirmation } from './rsvp-confirmation.tsx'
import { template as eventReminder } from './event-reminder.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'event-cancelled': eventCancelled,
  'event-reactivated': eventReactivated,
  'user-approved': userApproved,
  'user-rejected': userRejected,
  'family-member-left': familyMemberLeft,
  'guest-approved': guestApproved,
  'guest-list-reminder': guestListReminder,
  'rsvp-confirmation': rsvpConfirmation,
  'event-reminder': eventReminder,
}
