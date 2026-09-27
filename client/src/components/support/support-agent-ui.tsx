import type { Hop, Provider, ResultState } from "@/lib/support.types";
import { Button } from "../ui/button";

type Props = {
  provider: Provider;
  onProviderChange: (p: Provider) => void;

  ticket: string;
  onTicketChange: (val: string) => void;

  loading: boolean;

  result: ResultState | null;

  onAgentRun: () => void;
  onNewConversation: () => void;
  onDecideAction: (actionId: string, decision: "approve" | "reject") => void;
  actionLoadingId: string | null;
};

function hopLabel(hop: Hop): string {
  switch (hop.type) {
    case "web_search":
      return `Web search: "${hop.query}" — ${hop.resultCount} result${hop.resultCount === 1 ? "" : "s"}`;
    case "order_lookup":
      return hop.found
        ? `Looked up order ${hop.orderId} — found`
        : `Looked up order ${hop.orderId} — not found`;
    case "policy_search":
      return `Searched policy docs: "${hop.query}" — ${hop.resultCount} match${hop.resultCount === 1 ? "" : "es"}`;
    case "refund_proposed":
      return `Proposed refund of ${hop.amount} for ${hop.orderId} (pending approval)`;
  }
}

function hopIcon(hop: Hop): string {
  switch (hop.type) {
    case "web_search":
      return "🔎";
    case "order_lookup":
      return "📦";
    case "policy_search":
      return "📄";
    case "refund_proposed":
      return "💳";
  }
}

function SupportAgentUi(props: Props) {
  const {
    result,
    provider,
    loading,
    onProviderChange,
    ticket,
    onTicketChange,
    onAgentRun,
    onNewConversation,
    onDecideAction,
    actionLoadingId,
  } = props;

  return (
    <div className="min-h-screen bg-white">
      <div className="relative mx-auto max-w-7xl px-4 py-8">
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700 shadow-sm">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-800" />
              Live Agent Console
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
              Support Desk Agent
            </h1>
          </div>

          <button
            onClick={onNewConversation}
            disabled={loading}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50"
          >
            + New conversation
          </button>
        </div>

        {(result?.sources?.length ?? 0) > 0 ? (
          <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700">
            Sources
            <b>{result!.sources.length}</b>
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <div className="mt-2 text-sm text-slate-600">
            Provide the ticket only. The agent remembers this conversation
            until you start a new one.
          </div>

          <div className="mt-5 grid gap-4">
            <div className="space-y-2">
              <label className="text-xl font-semibold text-slate-700">
                Select Provider
              </label>
              <select
                value={provider}
                onChange={(event) =>
                  onProviderChange(event.target.value as Provider)
                }
                disabled={loading}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:ring-4 focus:ring-indigo-100"
              >
                <option value={"auto"}>Auto (Best available)</option>
                <option value={"openai"}>OpenAI (GPT-4o mini)</option>
                <option value={"gemini"}>Gemini (3.5 Flash Lite)</option>
                <option value={"anthropic"}>Anthropic (Claude Haiku)</option>
                <option value={"groq"}>Groq (Llama 3.3 70B)</option>
                <option value={"mistral"}>Mistral (Small)</option>
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xl font-semibold text-slate-700">
                Client Ticket/Email
              </label>
              <textarea
                value={ticket}
                disabled={loading}
                onChange={(e) => onTicketChange(e.target.value)}
                placeholder='Try: "What is your refund policy for annual plans?" or "Can I get a refund for ORD-1001?"'
                className="min-h-50 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm  outline-none focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <Button onClick={onAgentRun} disabled={loading} className="w-full">
              {loading ? "Running" : "Run"}
            </Button>
          </div>
        </div>

        {/* right side view */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="mt-2 text-sm text-slate-900">
              Customer Reply + Sources
            </div>
          </div>

          {!result ? (
            <div className="mt-4 text-sm p-4 text-slate-600">
              Nothing yet. Run the agent to generate the reply you want
            </div>
          ) : (
            <div className="mt-5 space-y-5">
              {result.hops.length > 0 ? (
                <div className="space-y-2">
                  <h1 className="text-sm font-medium text-slate-900">
                    Reasoning trace ({result.hops.length}{" "}
                    {result.hops.length === 1 ? "step" : "steps"})
                  </h1>
                  <ol className="space-y-2">
                    {result.hops.map((hop, i) => (
                      <li
                        key={i}
                        className="rounded-2xl border border-slate-200 bg-white/90 p-3 text-sm text-slate-900 shadow-sm"
                      >
                        <span className="mr-2">{hopIcon(hop)}</span>
                        <span className="font-medium">Step {i + 1}:</span>{" "}
                        {hopLabel(hop)}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {result.pendingActions.length > 0 ? (
                <div className="space-y-2">
                  <h1 className="text-sm font-medium text-slate-900">
                    Pending approvals
                  </h1>
                  <ol className="space-y-2">
                    {result.pendingActions.map((action) => (
                      <li
                        key={action.id}
                        className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-900 shadow-sm"
                      >
                        <div>
                          Refund of{" "}
                          <b>
                            {action.payload.amount} for {action.payload.orderId}
                          </b>
                          {" — "}
                          <span className="italic">{action.payload.reason}</span>
                        </div>

                        {action.status === "pending" ? (
                          <div className="mt-2 flex gap-2">
                            <button
                              onClick={() => onDecideAction(action.id, "approve")}
                              disabled={actionLoadingId === action.id}
                              className="rounded-lg bg-emerald-700 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => onDecideAction(action.id, "reject")}
                              disabled={actionLoadingId === action.id}
                              className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                              Reject
                            </button>
                          </div>
                        ) : (
                          <div className="mt-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                            {action.status}
                          </div>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              {result.sources.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-900 shadow-sm">
                  <ul className="list-disc space-y-1 pl-5">
                    {result.sources.map((source, i) => (
                      <li key={i} className="break-all">
                        <a
                          href={source}
                          target="_blank"
                          rel="noreferer"
                          className="text-indigo-800 hover:underline"
                        >
                          {source}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="space-y-2">
                <h1 className="text-sm font-medium text-slate-900">
                  Customer Reply
                </h1>
                <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 text-sm text-slate-900 shadow-sm">
                  <div className="whitespace-pre-wrap leading-relaxed">
                    {result.reply}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SupportAgentUi;
