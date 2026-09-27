import { pool } from "../db/pool";

export type Company = {
  id: string;
  name: string;
  domain: string | null;
  createdAt: string;
};

function emailDomain(email: string): string {
  return email.trim().toLowerCase().split("@")[1] ?? "";
}

/**
 * Used by the email/password signup flow, where the person explicitly
 * types a company name. Finds an existing company with that exact name
 * (case-insensitive) so a second employee from the same company joins
 * the same tenant, or creates a new one.
 */
export async function findOrCreateCompanyByName(name: string): Promise<Company> {
  const trimmed = name.trim();

  const existing = await pool.query<Company>(
    `SELECT id, name, domain, created_at AS "createdAt"
     FROM companies WHERE lower(name) = lower($1) LIMIT 1`,
    [trimmed],
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await pool.query<Company>(
    `INSERT INTO companies (name) VALUES ($1)
     RETURNING id, name, domain, created_at AS "createdAt"`,
    [trimmed],
  );
  return created.rows[0];
}

/**
 * Used by SSO (ScaleKit) and the E2E test-login flow, neither of which
 * collect a company name explicitly. Infers the company from the
 * user's email domain (e.g. "jane@acme.com" -> "acme.com"), so everyone
 * at the same company lands in the same tenant automatically.
 */
export async function findOrCreateCompanyByDomain(email: string): Promise<Company> {
  const domain = emailDomain(email);

  const existing = await pool.query<Company>(
    `SELECT id, name, domain, created_at AS "createdAt"
     FROM companies WHERE domain = $1 LIMIT 1`,
    [domain],
  );
  if (existing.rows[0]) return existing.rows[0];

  const created = await pool.query<Company>(
    `INSERT INTO companies (name, domain) VALUES ($1, $2)
     RETURNING id, name, domain, created_at AS "createdAt"`,
    [domain, domain],
  );
  return created.rows[0];
}
