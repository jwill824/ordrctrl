// T063 — Zod validation schemas for integrations routes
import { z } from 'zod';

export const serviceIdSchema = z.enum([
  'gmail',
  'apple_reminders',
  'microsoft_tasks',
  'apple_calendar',
]);

export const connectQuerySchema = z.object({
  syncMode: z.enum(['all_unread', 'starred_only']).optional(),
});

export const gmailSyncModeSchema = z.object({
  syncMode: z.enum(['all_unread', 'starred_only']),
});
