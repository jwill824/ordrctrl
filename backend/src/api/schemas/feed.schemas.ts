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

// T005 — dismiss/restore param schema (reused by PATCH and DELETE)
export const dismissParamSchema = z.object({
  itemId: z
    .string()
    .regex(
      /^(sync|native):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
      'Invalid itemId format. Expected "sync:<uuid>" or "native:<uuid>"'
    ),
});

// T018 — pagination schema for GET /api/feed/dismissed
export const dismissedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
});
