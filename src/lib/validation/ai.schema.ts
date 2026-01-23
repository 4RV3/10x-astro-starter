import { z } from 'zod';

export const generateCardsCommandSchema = z.object({
  input_text: z.string().trim().min(1, 'Input text is required').max(8000),
});

export const aiCardProposalSchema = z.object({
  front: z.string().trim().min(1).max(4000),
  back: z.string().trim().min(1).max(4000),
  source_snippet: z.string().trim().min(1).max(4000),
});

export const saveAICardsBatchCommandSchema = z.object({
  cards: z.array(aiCardProposalSchema).min(1, 'Cards batch cannot be empty'),
});
