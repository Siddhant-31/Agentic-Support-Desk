import { pool } from "../db/pool";

// Conversation memory, now real rows in Postgres instead of an
// in-memory Map - it survives a server restart, and every row carries
// company_id so one company's conversation history is never visible to
// another. Each user has one "active" conversation at a time; starting
// a new one (via the "New conversation" button) just opens a fresh
// conversation row rather than deleting the old one, so history isn't
// destroyed - it's simply no longer the one being continued.

export type MemoryMessage = { role: "user" | "assistant"; content: string };

const MAX_TURNS = 6; // 6 user+assistant exchanges replayed as context

/**
 * Returns the user's most recent conversation id, or creates one if they
 * don't have one yet. Pass forceNew to always start a fresh conversation
 * (used for the "New conversation" action).
 */
export async function getOrCreateConversation(
  companyId: string,
  userId: string,
  opts: { forceNew?: boolean } = {},
): Promise<string> {
  if (!opts.forceNew) {
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM conversations
       WHERE company_id = $1 AND user_id = $2
       ORDER BY created_at DESC LIMIT 1`,
      [companyId, userId],
    );
    if (existing.rows[0]) return existing.rows[0].id;
  }

  const created = await pool.query<{ id: string }>(
    `INSERT INTO conversations (company_id, user_id) VALUES ($1, $2) RETURNING id`,
    [companyId, userId],
  );
  return created.rows[0].id;
}

export async function getHistory(conversationId: string): Promise<MemoryMessage[]> {
  // Grab the most recent MAX_TURNS*2 messages (newest first), then
  // re-sort chronologically - plain "ORDER BY created_at ASC LIMIT n"
  // would return the *oldest* messages instead of the most recent ones.
  const result = await pool.query<MemoryMessage & { created_at: string }>(
    `SELECT role, content, created_at FROM (
       SELECT role, content, created_at FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at DESC
       LIMIT $2
     ) recent
     ORDER BY created_at ASC`,
    [conversationId, MAX_TURNS * 2],
  );
  return result.rows.map((r) => ({ role: r.role, content: r.content }));
}

export async function appendTurn(
  conversationId: string,
  userMessage: string,
  assistantMessage: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO messages (conversation_id, role, content)
     VALUES ($1, 'user', $2), ($1, 'assistant', $3)`,
    [conversationId, userMessage, assistantMessage],
  );
}
