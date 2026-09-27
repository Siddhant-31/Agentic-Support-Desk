import { Router } from "express";
import { setSessionCookie } from "./cookie";
import { findOrCreateCompanyByDomain } from "../support/companies.store";
import { findOrCreateSsoUser } from "./users.store";

const router = Router();

function checkE2EMode() {
  const isProd = process.env.NODE_ENV === "production";
  const enabled = process.env.E2E_TEST_MODE === "true";

  if (isProd || !enabled) return false;

  return true;
}

router.post("/e2e/login", async (req, res) => {
  if (!checkE2EMode()) {
    return res.status(404).json({ error: "Not found" });
  }

  const email =
    typeof req.body?.email === "string" ? req.body.email : "e2e@test.local";

  const name = typeof req.body?.name === "string" ? req.body.name : "E2E user";

  // Other tables (conversations, pending_actions, ...) have a foreign
  // key on user_id, so this needs to be a real row in the `users` table
  // - not just an arbitrary string id like before Postgres was added.
  // The company is inferred from the email's domain, same as real SSO.
  const company = await findOrCreateCompanyByDomain(email);
  const user = await findOrCreateSsoUser({ companyId: company.id, name, email });

  setSessionCookie(res, {
    id: user.id,
    companyId: user.companyId,
    email: user.email,
    name: user.name,
  });

  return res.json({ ok: true });
});

router.post("/e2e/logout", (req, res) => {
  if (!checkE2EMode()) {
    return res.status(404).json({ error: "Not found" });
  }

  res.clearCookie(process.env.SESSION_COOKIE_NAME!, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
  });

  return res.json({ ok: true });
});

export default router;
