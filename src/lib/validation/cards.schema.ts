import { z } from 'zod';

export const createCardCommandSchema = z.object({
  front: z.string().trim().min(1, 'Front is required').max(4000),
  back: z.string().trim().min(1, 'Back is required').max(4000),
  source_snippet: z.string().trim().min(1, 'Source snippet is required').max(4000),
});

export const listCardsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v == null ? 1 : Number(v)))
    .pipe(z.number().int().min(1)),
  page_size: z
    .string()
    .optional()
    .transform((v) => (v == null ? 20 : Number(v)))
    .pipe(z.number().int().min(1).max(100)),
  sort: z
    .string()
    .optional()
    .refine(
      (v) => v == null || ['created_at_asc', 'created_at_desc', 'due_at_asc'].includes(v),
      { message: 'Invalid sort' }
    ),
  origin: z.string().optional().refine((v) => v == null || ['manual', 'ai'].includes(v), {
    message: 'Invalid origin',
  }),
});

export const cardIdParamSchema = z.object({ id: z.string().uuid('Invalid card id') });

export const updateCardCommandSchema = z
  .object({
    front: z.string().optional().transform((v) => (v == null ? undefined : v.trim())),
    back: z.string().optional().transform((v) => (v == null ? undefined : v.trim())),
    source_snippet: z
      .string()
      .optional()
      .transform((v) => (v == null ? undefined : v.trim())),
  })
  .refine((obj) => !!(obj.front || obj.back || obj.source_snippet), {
    message: 'At least one field must be provided',
  })
  .refine(
    (obj) => [obj.front, obj.back, obj.source_snippet].every((v) => v == null || v.length > 0),
    { message: 'Provided fields must be non-empty after trim' }
  );
