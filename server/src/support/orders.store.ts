import { pool } from "../db/pool";

export type Order = {
  id: string;
  companyId: string;
  customer: string;
  product: string;
  amount: number;
  currency: string;
  purchaseDate: string;
  status: "active" | "cancelled";
  refundStatus: "none" | "pending" | "refunded";
};

const SELECT_FIELDS = `
  id, company_id AS "companyId", customer, product,
  amount, currency, purchase_date AS "purchaseDate",
  status, refund_status AS "refundStatus"
`;

/**
 * Order IDs (e.g. ORD-1001) are only unique *within* a company - the
 * primary key is (company_id, id) - so every lookup here is always
 * scoped to the calling company. This is the core of multi-tenancy for
 * orders: there is no way to accidentally read another company's order,
 * because companyId is a required argument, not an afterthought filter.
 */
export async function findOrder(
  companyId: string,
  orderId: string,
): Promise<Order | undefined> {
  const result = await pool.query<Order>(
    `SELECT ${SELECT_FIELDS} FROM orders
     WHERE company_id = $1 AND upper(id) = upper($2)
     LIMIT 1`,
    [companyId, orderId.trim()],
  );
  return result.rows[0];
}

export async function markRefundPending(
  companyId: string,
  orderId: string,
): Promise<Order | undefined> {
  const result = await pool.query<Order>(
    `UPDATE orders SET refund_status = 'pending'
     WHERE company_id = $1 AND upper(id) = upper($2)
     RETURNING ${SELECT_FIELDS}`,
    [companyId, orderId.trim()],
  );
  return result.rows[0];
}

export async function markRefunded(
  companyId: string,
  orderId: string,
): Promise<Order | undefined> {
  const result = await pool.query<Order>(
    `UPDATE orders SET refund_status = 'refunded'
     WHERE company_id = $1 AND upper(id) = upper($2)
     RETURNING ${SELECT_FIELDS}`,
    [companyId, orderId.trim()],
  );
  return result.rows[0];
}
