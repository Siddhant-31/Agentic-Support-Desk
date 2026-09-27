import { tool } from "langchain";
import { z } from "zod";
import { tavilySearch, TavilyResult } from "./tavily";
import { findOrder } from "./orders.store";
import { searchPolicy } from "./policy-search";
import { createPendingAction } from "./pending-actions.store";

// A single, tagged record of "the agent took an action." Every tool
// below pushes one of these into the shared `hops` array, which is what
// makes the whole run auditable/traceable: independent of what the
// model claims in its final reply, we know exactly which tools were
// called, with what inputs, and what came back.
export type ToolHop =
  | { type: "web_search"; query: string; results: TavilyResult[] }
  | { type: "order_lookup"; orderId: string; found: boolean }
  | { type: "policy_search"; query: string; resultCount: number }
  | { type: "refund_proposed"; orderId: string; amount: number; actionId: string };

/**
 * Builds a web_search tool the agent can call on its own.
 *
 * Unlike a classic RAG setup (search once, before the model runs),
 * this tool is handed to the LLM directly. The model decides:
 *  - whether to search at all
 *  - what to search for
 *  - whether one search was enough, or it needs to refine the query
 *    and search again based on what it just learned
 *
 * Every call is recorded into `hops`, so the route handler can later
 * validate that any cited source actually came from a real search.
 */
export function createWebSearchTool(hops: ToolHop[]) {
  return tool(
    async ({ query }: { query: string }) => {
      const trimmedQuery = query.trim().slice(0, 200);
      const results = await tavilySearch({ query: trimmedQuery });

      hops.push({ type: "web_search", query: trimmedQuery, results });

      if (!results.length) {
        return "No results found for that query.";
      }

      return results
        .map(
          (result, index) =>
            `#${index + 1} ${result.title}\n${result.url}\n${result.snippet}`,
        )
        .join("\n\n");
    },
    {
      name: "web_search",
      description:
        "Search the web for current, technical, or documentation-related " +
        "information (integrations, auth, APIs, webhooks, SDKs, SSO, etc). " +
        "Call again with a refined query if the first result doesn't fully " +
        "answer the question. Skip for simple, non-technical tickets.",
      schema: z.object({
        query: z.string().min(1).describe("A focused search query"),
      }),
    },
  );
}

/**
 * Looks up a specific order by ID in the mock order database. This is
 * the "real database" tool - lets the agent answer account/order-
 * specific questions ("what's the status of ORD-1003?") that a web
 * search or general model knowledge could never know.
 */
export function createOrderLookupTool(hops: ToolHop[], companyId: string) {
  return tool(
    async ({ orderId }: { orderId: string }) => {
      const order = await findOrder(companyId, orderId);
      hops.push({ type: "order_lookup", orderId, found: !!order });

      if (!order) {
        return `No order found with id "${orderId}". Ask the customer to double check the order/ticket ID.`;
      }

      return JSON.stringify(order, null, 2);
    },
    {
      name: "lookup_order",
      description:
        "Look up a specific order by its order ID (e.g. ORD-1001) to check " +
        "its status, amount, purchase date, and refund status. Use this " +
        "whenever the customer references a specific order/invoice, or " +
        "before proposing any refund.",
      schema: z.object({
        orderId: z.string().min(1).describe("The order ID, e.g. ORD-1001"),
      }),
    },
  );
}

/**
 * Searches the company's own policy documents (refund policy, SLA
 * policy, etc). This is the RAG tool: retrieval happens over local
 * documents instead of the open web, so answers are grounded in the
 * company's actual rules instead of the model's generic knowledge of
 * "how refunds usually work."
 */
export function createPolicySearchTool(hops: ToolHop[], companyId: string) {
  return tool(
    async ({ query }: { query: string }) => {
      const chunks = await searchPolicy(companyId, query, 3);
      hops.push({ type: "policy_search", query, resultCount: chunks.length });

      if (!chunks.length) {
        return "No matching policy found for that query.";
      }

      return chunks
        .map(
          (chunk, index) =>
            `#${index + 1} [${chunk.source} - ${chunk.heading}]\n${chunk.text}`,
        )
        .join("\n\n");
    },
    {
      name: "search_policy",
      description:
        "Search the company's own refund and SLA policy documents. Use " +
        "this before answering any question about refund eligibility, " +
        "refund amounts, cancellation rules, or support response-time " +
        "commitments - never guess these from general knowledge.",
      schema: z.object({
        query: z.string().min(1).describe("What policy question to search for"),
      }),
    },
  );
}

/**
 * Proposes a refund - but does NOT execute it. This is the
 * human-in-the-loop action tool: it only records a pending action for a
 * human to approve/reject via a separate endpoint. The agent should
 * tell the customer the refund is "pending approval," never that it's
 * done.
 */
export function createProposeRefundTool(
  hops: ToolHop[],
  companyId: string,
  userId: string,
) {
  return tool(
    async ({
      orderId,
      amount,
      reason,
    }: {
      orderId: string;
      amount: number;
      reason: string;
    }) => {
      const order = await findOrder(companyId, orderId);

      if (!order) {
        return `Cannot propose a refund: no order found with id "${orderId}".`;
      }

      const action = await createPendingAction({
        companyId,
        userId,
        type: "refund",
        payload: { orderId, amount, reason },
      });

      hops.push({
        type: "refund_proposed",
        orderId,
        amount,
        actionId: action.id,
      });

      return (
        `Refund of ${amount} ${order.currency} for ${orderId} has been ` +
        `PROPOSED and is now pending human approval (action id ${action.id}). ` +
        `It has NOT been issued yet. Tell the customer this is pending review.`
      );
    },
    {
      name: "propose_refund",
      description:
        "Propose a refund for a specific order. This does NOT issue the " +
        "refund - it only creates a pending request that a human support " +
        "manager must approve before anything is actually refunded. Only " +
        "call this after looking up the order and checking the refund " +
        "policy to determine a reasonable amount.",
      schema: z.object({
        orderId: z.string().min(1),
        amount: z.number().positive(),
        reason: z.string().min(1),
      }),
    },
  );
}
