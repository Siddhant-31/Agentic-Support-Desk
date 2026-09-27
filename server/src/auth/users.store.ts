import bcrypt from "bcryptjs";
import { pool } from "../db/pool";

export type StoredUser = {
  id: string;
  companyId: string;
  name: string;
  email: string;
  passwordHash: string | null;
  createdAt: string;
};

// Email lookup is intentionally global (not scoped to one company) here
// because login happens before we know which company the person belongs
// to - the row itself carries company_id, which is what everything
// downstream then scopes by.
export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const result = await pool.query<StoredUser>(
    `SELECT id, company_id AS "companyId", name, email,
            password_hash AS "passwordHash", created_at AS "createdAt"
     FROM users WHERE lower(email) = lower($1) LIMIT 1`,
    [email.trim()],
  );
  return result.rows[0];
}

export async function findUserById(id: string): Promise<StoredUser | undefined> {
  const result = await pool.query<StoredUser>(
    `SELECT id, company_id AS "companyId", name, email,
            password_hash AS "passwordHash", created_at AS "createdAt"
     FROM users WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0];
}

export async function createUser(params: {
  companyId: string;
  name: string;
  email: string;
  password: string;
}): Promise<StoredUser> {
  const passwordHash = await bcrypt.hash(params.password, 10);

  const result = await pool.query<StoredUser>(
    `INSERT INTO users (company_id, name, email, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING id, company_id AS "companyId", name, email,
               password_hash AS "passwordHash", created_at AS "createdAt"`,
    [params.companyId, params.name.trim(), params.email.trim().toLowerCase(), passwordHash],
  );
  return result.rows[0];
}

/**
 * Used by SSO logins, which don't have a local password. Creates a user
 * row with no password_hash so they can only ever log in via SSO.
 */
export async function findOrCreateSsoUser(params: {
  companyId: string;
  name: string;
  email: string;
}): Promise<StoredUser> {
  const existing = await findUserByEmail(params.email);
  if (existing) return existing;

  const result = await pool.query<StoredUser>(
    `INSERT INTO users (company_id, name, email, password_hash)
     VALUES ($1, $2, $3, NULL)
     RETURNING id, company_id AS "companyId", name, email,
               password_hash AS "passwordHash", created_at AS "createdAt"`,
    [params.companyId, params.name.trim(), params.email.trim().toLowerCase()],
  );
  return result.rows[0];
}

export async function verifyPassword(user: StoredUser, password: string): Promise<boolean> {
  if (!user.passwordHash) return false; // SSO-only user, no local password to check
  return bcrypt.compare(password, user.passwordHash);
}
