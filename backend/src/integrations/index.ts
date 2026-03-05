// T038 — Adapter registry mapping ServiceId to adapter instances

import { GmailAdapter } from './gmail/index.js';
import { AppleRemindersAdapter } from './apple-reminders/index.js';
import { MicrosoftTasksAdapter } from './microsoft-tasks/index.js';
import { AppleCalendarAdapter } from './apple-calendar/index.js';
import type { IntegrationAdapter, ServiceId } from './_adapter/types.js';

export const adapters: Record<ServiceId, IntegrationAdapter> = {
  gmail: new GmailAdapter(),
  apple_reminders: new AppleRemindersAdapter(),
  microsoft_tasks: new MicrosoftTasksAdapter(),
  apple_calendar: new AppleCalendarAdapter(),
};

export function getAdapter(serviceId: ServiceId): IntegrationAdapter {
  const adapter = adapters[serviceId];
  if (!adapter) {
    throw new Error(`No adapter registered for serviceId: ${serviceId}`);
  }
  return adapter;
}

export type { ServiceId, IntegrationAdapter } from './_adapter/types.js';
