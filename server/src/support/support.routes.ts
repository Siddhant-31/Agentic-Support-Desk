import { Router } from "express";
import { DraftSchema, Provider, RequestSchema } from "./support.schema";
import { createAgent, toolStrategy } from "langchain";
import { MessagesValue, StateSchema } from "@langchain/langgraph";
import {
  createWebSearchTool,
  createOrderLookupTool,
  createPolicySearchTool,
  createProposeRefundTool,
  ToolHop,
} from "./tools";
import { appendTurn, getHistory, getOrCreateConversation } from "./memory.store";
import {
  decideAction,
  getPendingAction,
  listPendingActionsForUser,
} from "./pending-actions.store";
import { markRefunded } from "./orders.store";

const router = Router();

// Hard ceiling on reasoning hops. Without this an agent can loop
// indefinitely if it keeps deciding it needs "one more search" -
// bounded autonomy, not unconstrained autonomy.
const MAX_HOPS = 4;

// Maps each selectable provider to a langchain "provider:model" id and
// the env var that must be set for it to work.
const PROVIDER_MODELS: Record<Exclude<Provider, "auto">, { model: string; envKey: string }> = {
  openai: { model: "openai:gpt-4o-mini", envKey: "OPENAI_API_KEY" },
  gemini: { model: "google-genai:gemini-3.5-flash-lite", envKey: "GOOGLE_API_KEY" },
  anthropic: { model: "anthropic:claude-3-5-haiku-latest", envKey: "ANTHROPIC_API_KEY" },
  groq: { model: "groq:openai/gpt-oss-120b", envKey: "GROQ_API_KEY" },
  mistral: { model: "mistralai:mistral-small-latest", envKey: "MISTRAL_API_KEY" },
};

// "auto" / Best: try providers in this priority order and use whichever
// one has an API key configured in the environment. Lets the user pick
// "just give me the best answer" without caring which key is set up.
const AUTO_PRIORITY: Exclude<Provider, "auto">[] = [
  "anthropic",
  "openai",
  "gemini",
  "groq",
  "mistral",
];

function resolveProvider(provider: Provider): Exclude<Provider, "auto"> {
  if (provider !== "auto") return provider;

  const found = AUTO_PRIORITY.find((p) => !!process.env[PROVIDER_MODELS[p].envKey]);
  // Fall back to openai even if unconfigured - the resulting error will
  // clearly say "missing API key" rather than silently picking nothing.
  return found ?? "openai";
}

function modelIdFor(provider: Provider) {
  const resolved = resolveProvider(provider);
  return PROVIDER_MODELS[resolved].model;
}

const AgentState = new StateSchema({ messages: MessagesValue });

const SYSTEM_PROMPT = [
  "You are a B2B support desk agent.",
  "Write a customer-ready reply.",
  "",
  "Output ONLY strict JSON with this exact shape:",
  '{ "reply": string, "sources": string[] }',
  "",
  "You have four tools available. Decide for yourself which (if any) to",
  "use - most tickets don't need all of them:",
  "",
  "- web_search: for technical/documentation questions (integrations,",
  "  auth, APIs, webhooks, SDKs, SSO, etc). You may call it more than",
  "  once, refining the query based on what you learned.",
  "- lookup_order: whenever the customer references a specific order or",
  "  invoice ID, or before proposing any refund.",
  "- search_policy: before answering ANY question about refund",
  "  eligibility, refund amounts, cancellation rules, or support",
  "  response-time commitments. Never guess these from general",
  "  knowledge - always check the real policy first. This only searches",
  "  YOUR company's own policy documents.",
  "- propose_refund: only after you've looked up the order AND checked",
  "  the policy. This does not issue the refund - it only creates a",
  "  pending request a human must approve. Tell the customer the refund",
  "  is pending approval, never that it has been issued.",
  "",
  "Stop calling tools once you have enough to answer confidently, or",
  "after a few attempts - don't loop forever.",
  "",
  "Rules:",
  "- Be polite, clear, short paragraphs.",
  "- Ask for missing info if needed (e.g. an order ID you don't have).",
  "- Do NOT make strong promises (no guarantees), and NEVER tell a",
  "  customer a refund has been issued - only that it's pending, if you",
  "  proposed one.",
  "- If you used web_search at all, sources[] MUST contain 1-3 URLs that",
  "  were actually returned by web_search (not invented).",
  "- If you never called web_search, sources[] MUST be [].",
].join("\n");

function makeAgent(
  provider: Provider,
  hops: ToolHop[],
  companyId: string,
  userId: string,
) {
  const tools = [
    createWebSearchTool(hops),
    createOrderLookupTool(hops, companyId),
    createPolicySearchTool(hops, companyId),
    createProposeRefundTool(hops, companyId, userId),
  ];

  return createAgent({
    model: modelIdFor(provider),
    stateSchema: AgentState,
    tools,
    responseFormat: toolStrategy(DraftSchema),
    systemPrompt: SYSTEM_PROMPT,
  });
}

function uniq(arr: string[]) {
  return Array.from(new Set(arr));
}

function isHttpUrl(input: string) {
  try {
    const check = new URL(input);
    return check.protocol === "http:" || check.protocol === "https:";
  } catch {
    return false;
  }
}

router.post("/run", async (req, res) => {
  const parsed = RequestSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid input" });
  }

  const { id: userId, companyId } = req.user!;
  const { provider, text, reset } = parsed.data;
  const ticket = text.trim();

  // Every tool call the agent makes across every hop lands here. This is
  // what makes the pipeline auditable: we know exactly what was looked
  // up and what came back, independent of what the model claims.
  const hops: ToolHop[] = [];

  try {
    const conversationId = await getOrCreateConversation(companyId, userId, {
      forceNew: reset,
    });

    const agent = makeAgent(provider, hops, companyId, userId);

    // Prior turns (user+assistant pairs only, no tool trace) give the
    // agent conversation memory across requests from the same user -
    // now read from Postgres instead of an in-memory Map, so it
    // survives a server restart.
    const priorHistory = await getHistory(conversationId);
    const priorMessages = priorHistory.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    const out = await agent.invoke(
      { messages: [...priorMessages, { role: "user", content: ticket }] },
      // Reason + act pairs per hop, plus headroom for the final answer turn
      // and the extra tool-call turn toolStrategy needs to emit the
      // structured response.
      { recursionLimit: MAX_HOPS * 2 + 6 },
    );

    const draft = DraftSchema.parse(out.structuredResponse);

    let sources = uniq(draft.sources).filter(
      (source) => typeof source === "string",
    );
    sources = sources.filter(isHttpUrl).slice(0, 3);

    const searchHops = hops.filter((h) => h.type === "web_search");
    const didSearch = searchHops.length > 0;

    if (didSearch) {
      // Union of every URL returned across every web_search hop - the
      // only sources the model is allowed to have cited.
      const allowed = uniq(
        searchHops.flatMap((hop) =>
          hop.results
            .map((result) => (typeof result.url === "string" ? result.url.trim() : ""))
            .filter(Boolean),
        ),
      );

      if (sources.length === 0) {
        return res.status(422).json({ error: "sources are empty" });
      }

      const badSources = sources.filter((source) => !allowed.includes(source));

      if (badSources.length > 0) {
        return res.status(422).json({
          error: "sources not allowed",
          badSources,
          allowedSources: allowed.slice(0, 3),
        });
      }
    } else {
      sources = [];
    }

    // Remember this turn for follow-up tickets from the same user.
    await appendTurn(conversationId, ticket, draft.reply);

    return res.json({
      reply: draft.reply,
      sources,
      hops,
      pendingActions: await listPendingActionsForUser(companyId, userId),
    });
  } catch (e) {
    console.error("SUPPORT RUN ERROR:", e);
    return res.status(500).json({ error: "Support agent failed" });
  }
});

// Human-in-the-loop: approve or reject a proposed refund. Nothing about
// the order changes until this endpoint is called - the agent itself
// can never execute a refund on its own. Every lookup here is scoped to
// the caller's company_id, so no one can approve/reject another
// company's pending action, even with a guessed valid id.
router.post("/actions/:id/approve", async (req, res) => {
  const { companyId, id: userId } = req.user!;
  const action = await getPendingAction(companyId, req.params.id);

  if (!action || action.userId !== userId) {
    return res.status(404).json({ error: "Action not found" });
  }
  if (action.status !== "pending") {
    return res.status(409).json({ error: `Action already ${action.status}` });
  }

  await decideAction(companyId, action.id, "approved");
  await markRefunded(companyId, action.payload.orderId);

  return res.json({ ok: true, action: { ...action, status: "approved" } });
});

router.post("/actions/:id/reject", async (req, res) => {
  const { companyId, id: userId } = req.user!;
  const action = await getPendingAction(companyId, req.params.id);

  if (!action || action.userId !== userId) {
    return res.status(404).json({ error: "Action not found" });
  }
  if (action.status !== "pending") {
    return res.status(409).json({ error: `Action already ${action.status}` });
  }

  await decideAction(companyId, action.id, "rejected");

  return res.json({ ok: true, action: { ...action, status: "rejected" } });
});

router.get("/actions/pending", async (req, res) => {
  const { companyId, id: userId } = req.user!;
  return res.json({ actions: await listPendingActionsForUser(companyId, userId) });
});

export default router;
