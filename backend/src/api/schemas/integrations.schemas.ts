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

export const importFilterBodySchema = z.object({
  importEverything: z.boolean(),
  selectedSubSourceIds: z.array(z.string()).default([]),
}).refine(
  (data) => data.importEverything || data.selectedSubSourceIds.length > 0,
  { message: 'Must select at least one sub-source or enable Import Everything' }
);
export type ImportFilterBody = z.infer<typeof importFilterBodySchema>;
