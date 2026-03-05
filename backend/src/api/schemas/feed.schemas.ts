// T063 — Zod validation schemas for feed routes
import { z } from 'zod';

export const feedQuerySchema = z.object({
  includeCompleted: z
    .string()
    .optional()
    .transform((v) => v === 'true'),
});

export const completeItemParamSchema = z.object({
  itemId: z
    .string()
    .regex(
      /^(sync|native):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Invalid itemId format. Expected "sync:<uuid>" or "native:<uuid>"'
    ),
});
