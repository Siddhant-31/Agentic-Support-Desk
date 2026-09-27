import { z } from "zod";

export const HopSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("web_search"), query: z.string(), resultCount: z.number() }),
  z.object({ type: z.literal("order_lookup"), orderId: z.string(), found: z.boolean() }),
  z.object({ type: z.literal("policy_search"), query: z.string(), resultCount: z.number() }),
  z.object({
    type: z.literal("refund_proposed"),
    orderId: z.string(),
    amount: z.number(),
    actionId: z.string(),
  }),
]);

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

export const ResponseSchema = z.object({
  reply: z.string(),
  sources: z.array(z.string()).default([]),
  hops: z.array(HopSchema).default([]),
  pendingActions: z.array(PendingActionSchema).default([]),
});

export type Hop = z.infer<typeof HopSchema>;
export type PendingActionDTO = z.infer<typeof PendingActionSchema>;
export type SupportResponse = z.infer<typeof ResponseSchema>;

export type Provider =
  | "openai"
  | "gemini"
  | "anthropic"
  | "groq"
  | "mistral"
  | "auto";

export type ResultState = {
  reply: string;
  sources: string[];
  hops: Hop[];
  pendingActions: PendingActionDTO[];
};

export type CallAgentPayload = {
  provider: Provider;
  text: string;
  reset?: boolean;
};
