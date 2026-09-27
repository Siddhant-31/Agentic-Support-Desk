# What changed: single-hop RAG → multi-hop agentic AI

The original `POST /api/support/run` pipeline was a fixed sequence your
code controlled: a regex decided *whether* to search, one Tavily call ran
*before* the model, and the LLM saw the results as static context. That's
RAG, not an agent — the model never made a decision about tool use.

This version hands the model a real tool and lets it drive the loop.

## What's different

### `server/src/support/tools.ts` (new)
Defines `web_search` as a LangChain `tool()` the model can call itself,
with a `schema` (what arguments it needs) and a `description` (when to
use it). Every call is recorded into a `hops` array — an audit trail of
exactly what was searched and what came back.

### `server/src/support/support.routes.ts` (rewritten)
- `tools: [webSearchTool]` is passed into `createAgent` — previously empty.
- The system prompt tells the model it may call `web_search` **more than
  once**, refining its query based on what it learned from the previous
  call. This is what makes it multi-hop rather than "search once,
  maybe."
- `recursionLimit` caps how many reason→act cycles the agent can run
  (`MAX_HOPS = 4`). This is a deliberate constraint: bounded autonomy,
  not an open-ended loop that can spiral in cost or latency.
- The source-validation guardrail (reject any cited URL that wasn't
  actually returned by a search) now checks against the **union of every
  hop**, not a single batch.
- The response includes a `hops` array (`{ query, resultCount }[]`) so
  the reasoning trace is inspectable, not just the final answer.

### `server/src/support/support.schema.ts`
Added `HopSchema` for the trace shape.

### `client/src/lib/support.types.ts`, `pages/support.tsx`,
### `components/support/support-agent-ui.tsx`
Threaded the `hops` field through the client and added a "Reasoning
trace" panel above the sources list, showing each search the agent chose
to run and how many results it got — turning the audit trail into
something the support team can actually see.

## Why this is now "agentic"

| | Before | After |
|---|---|---|
| Decides whether to search | your regex | the model |
| Decides how many times | 0 or 1, fixed | 0–4, model's call |
| Can refine a query based on a prior result | no | yes |
| Control flow owner | your route handler | the model, within a hard cap |

This is a ReAct-style agent: Reason → Act (tool call) → Observe → repeat
until the model decides it has enough, or the hop limit is hit.
