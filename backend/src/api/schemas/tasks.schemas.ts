// T063 — Zod validation schemas for native task routes
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be at most 500 characters'),
  dueAt: z.string().datetime({ message: 'Invalid ISO 8601 datetime' }).nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(500, 'Title must be at most 500 characters')
    .optional(),
  dueAt: z.string().datetime({ message: 'Invalid ISO 8601 datetime' }).nullable().optional(),
});

export const taskIdParamSchema = z.object({
  id: z
    .string()
    .uuid('Invalid task ID format'),
});
