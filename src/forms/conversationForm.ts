import { z } from 'zod';

export const inboxFiltersSchema = z.object({
  statusCode: z.string().optional(),
  priority: z.string().optional(),
  searchQuery: z.string().optional(),
});

export const sendMessageSchema = z.object({
  conversationId: z.number().int().positive({ message: 'A valid conversation ID is required.' }),
  text: z.string().trim().min(1, { message: 'A message cannot be empty.' }),
});

export const saveAiResponseSchema = z.object({
  conversationId: z.number().int().positive({ message: 'A valid conversation ID is required.' }),
  draftId: z.number().int().positive({ message: 'A valid draft ID is required.' }),
  selectedStrategyCode: z.string().trim().min(1, { message: 'A strategy code is required.' }),
  text: z.string().trim().optional(),
  groundedFactsUsed: z.array(z.string()).readonly().default([]),
  ungroundedClaims: z.array(z.string()).readonly().default([]),
  confidence: z.number().min(0).max(1).optional(),
  suggestedAction: z.string().optional(),
  customDraftText: z.string().trim().nullable().optional(),
});

export type InboxFiltersInput = z.infer<typeof inboxFiltersSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type SaveAiResponseFormInput = z.infer<typeof saveAiResponseSchema>;
