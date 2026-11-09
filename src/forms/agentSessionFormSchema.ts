import { z } from 'zod';

export const takeoverSessionSchema = z.object({
  conversationId: z
    .number()
    .int()
    .positive({ message: 'A valid conversation ID is required.' }),
  reason: z.string().optional(),
});

export const sendApprovedDraftSchema = z.object({
  conversationId: z
    .number()
    .int()
    .positive({ message: 'A valid conversation ID is required.' }),
  text: z
    .string()
    .trim()
    .min(1, { message: 'Message text cannot be empty.' })
    .max(2000, { message: 'Message text cannot exceed 2000 characters.' }),
  draftId: z.number().int().positive().optional(),
});

export const handbackToBotSchema = z.object({
  conversationId: z
    .number()
    .int()
    .positive({ message: 'A valid conversation ID is required.' }),
});

export const resolveSessionSchema = z.object({
  conversationId: z
    .number()
    .int()
    .positive({ message: 'A valid conversation ID is required.' }),
  resolutionNote: z.string().optional(),
  auditLogId: z.number().int().positive().optional(),
});

export type TakeoverSessionInput = z.infer<typeof takeoverSessionSchema>;
export type SendApprovedDraftInput = z.infer<typeof sendApprovedDraftSchema>;
export type HandbackToBotInput = z.infer<typeof handbackToBotSchema>;
export type ResolveSessionInput = z.infer<typeof resolveSessionSchema>;
