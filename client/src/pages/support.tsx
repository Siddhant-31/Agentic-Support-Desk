import SupportAgentUi from "@/components/support/support-agent-ui";
import { apiPost } from "@/lib/api";
import {
  ResponseSchema,
  type CallAgentPayload,
  type Provider,
  type ResultState,
  type SupportResponse,
} from "@/lib/support.types";
import { useState } from "react";

export default function Support() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [ticket, setTicket] = useState("");

  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const [result, setResult] = useState<ResultState | null>(null);

  function resetUiForNewTask() {
    setResult(null);
  }

  async function callAgent(payload: CallAgentPayload) {
    setLoading(true);

    const res = await apiPost("/api/support/run", payload);

    setLoading(false);

    if (!res.ok) {
      return null;
    }

    const parsed = ResponseSchema.safeParse(res.data);

    if (!parsed.success) {
      return null;
    }

    return parsed.data as SupportResponse;
  }

  async function startAgentRun() {
    resetUiForNewTask();

    const getTicket = ticket.trim();

    if (!getTicket) return;

    const data = await callAgent({ provider, text: getTicket });

    if (!data) return;

    setResult({
      reply: data.reply,
      sources: data.sources,
      hops: data.hops ?? [],
      pendingActions: data.pendingActions ?? [],
    });
  }

  // Starts a fresh conversation: server-side memory for this user is
  // cleared, so the next ticket won't be answered with prior context.
  async function startNewConversation() {
    resetUiForNewTask();
    setTicket("");
    await apiPost("/api/support/run", {
      provider,
      text: "New conversation started.",
      reset: true,
    });
  }

  async function decideAction(actionId: string, decision: "approve" | "reject") {
    setActionLoadingId(actionId);
    const res = await apiPost(`/api/support/actions/${actionId}/${decision}`);
    setActionLoadingId(null);

    if (!res.ok || !result) return;

    setResult({
      ...result,
      pendingActions: result.pendingActions.map((a) =>
        a.id === actionId
          ? { ...a, status: decision === "approve" ? "approved" : "rejected" }
          : a,
      ),
    });
  }

  return (
    <SupportAgentUi
      provider={provider}
      onProviderChange={setProvider}
      ticket={ticket}
      onTicketChange={setTicket}
      loading={loading}
      result={result}
      onAgentRun={startAgentRun}
      onNewConversation={startNewConversation}
      onDecideAction={decideAction}
      actionLoadingId={actionLoadingId}
    />
  );
}
