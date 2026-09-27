import z from "zod";

export const ProviderSchema = z.enum([
  "openai",
  "gemini",
  "anthropic",
  "groq",
  "mistral",
  "auto",
]);

export type Provider = z.infer<typeof ProviderSchema>;

export const RequestSchema = z.object({
  provider: ProviderSchema,
  text: z.string().min(1),
  // When true, the server clears this user's conversation memory before
  // running - used for a "New conversation" button in the UI.
  reset: z.boolean().optional(),
});

export const DraftSchema = z.object({
  reply: z.string().min(1),
  sources: z.array(z.string().min(1)).max(3),
});

export type SupportResponse = z.infer<typeof DraftSchema>;

// One entry per tool call the agent made, tagged by which tool it was.
// Exposed in the API response so the UI (and the user) can see the full
// reasoning trace - not just a final answer, but what the agent looked
// up and why, independent of what it claims in the reply text.
export const HopSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("web_search"),
    query: z.string(),
    resultCount: z.number(),
  }),
  z.object({
    type: z.literal("order_lookup"),
    orderId: z.string(),
    found: z.boolean(),
  }),
  z.object({
    type: z.literal("policy_search"),
    query: z.string(),
    resultCount: z.number(),
  }),
  z.object({
    type: z.literal("refund_proposed"),
    orderId: z.string(),
    amount: z.number(),
    actionId: z.string(),
  }),
]);

export type Hop = z.infer<typeof HopSchema>;

export const PendingActionSchema = z.object({
  id: z.string(),
  type: z.literal("refund"),
  payload: z.object({
    orderId: z.string(),
    amount: z.number(),
    reason: z.string(),
  }),
  status: z.enum(["pending", "approved", "rejected"]),
  createdAt: z.string(),
});

export type PendingActionDTO = z.infer<typeof PendingActionSchema>;
