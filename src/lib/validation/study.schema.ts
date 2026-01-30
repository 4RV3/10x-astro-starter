import { z } from "zod";

export const getDueCardsQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((val) => (val == null ? 20 : Number(val)))
    .pipe(z.number().int().min(1).max(100)),
  from_now: z.string().datetime().optional(),
});

export const submitReviewCommandSchema = z.object({
  card_id: z.string().uuid("Invalid card id"),
  grade: z
    .number()
    .int("Grade must be integer")
    .min(0, "Grade must be between 0 and 5")
    .max(5, "Grade must be between 0 and 5"),
});
