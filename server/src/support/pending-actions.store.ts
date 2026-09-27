import { pool } from "../db/pool";

// Persisted version of the human-in-the-loop pending-approval store.
// Previously an in-memory Map that reset on every server restart - now
// a real table, so a refund sitting there awaiting manager approval
// survives a deploy/restart. Every row carries company_id, so one
// company's pending actions are never visible to (or approvable by)
// another company's users.

export type PendingAction = {
  id: string;
  companyId: string;
  userId: string;
  type: "refund";
  payload: { orderId: string; amount: number; reason: string };
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  decidedAt?: string | null;
};

const SELECT_FIELDS = `
  id, company_id AS "companyId", user_id AS "userId", type, payload,
  status, created_at AS "createdAt", decided_at AS "decidedAt"
`;

export async function createPendingAction(params: {
  companyId: string;
  userId: string;
  type: "refund";
  payload: PendingAction["payload"];
}): Promise<PendingAction> {
  const result = await pool.query<PendingAction>(
    `INSERT INTO pending_actions (company_id, user_id, type, payload)
     VALUES ($1, $2, $3, $4)
     RETURNING ${SELECT_FIELDS}`,
    [params.companyId, params.userId, params.type, JSON.stringify(params.payload)],
  );
  return result.rows[0];
}

// Scoped to companyId as well as id: a caller can never fetch (and
// therefore never approve/reject) another company's pending action, even
// if they somehow guessed a valid action id.
export async function getPendingAction(
  companyId: string,
  id: string,
): Promise<PendingAction | undefined> {
  const result = await pool.query<PendingAction>(
    `SELECT ${SELECT_FIELDS} FROM pending_actions WHERE company_id = $1 AND id = $2 LIMIT 1`,
    [companyId, id],
  );
  return result.rows[0];
}

export async function decideAction(
  companyId: string,
  id: string,
  decision: "approved" | "rejected",
): Promise<PendingAction | undefined> {
  const result = await pool.query<PendingAction>(
    `UPDATE pending_actions
     SET status = $3, decided_at = now()
     WHERE company_id = $1 AND id = $2 AND status = 'pending'
     RETURNING ${SELECT_FIELDS}`,
    [companyId, id, decision],
  );
  return result.rows[0];
}

export async function listPendingActionsForUser(
  companyId: string,
  userId: string,
): Promise<PendingAction[]> {
  const result = await pool.query<PendingAction>(
    `SELECT ${SELECT_FIELDS} FROM pending_actions
     WHERE company_id = $1 AND user_id = $2 AND status = 'pending'
     ORDER BY created_at DESC`,
    [companyId, userId],
  );
  return result.rows;
}
