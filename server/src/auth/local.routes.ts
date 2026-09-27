import { Router } from "express";
import { z } from "zod";
import { setSessionCookie } from "./cookie";
import { createUser, findUserByEmail, verifyPassword } from "./users.store";
import { findOrCreateCompanyByName } from "../support/companies.store";

const router = Router();

const SignupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  companyName: z.string().min(1, "Company name is required"),
  email: z.string().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const LoginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

router.post("/signup", async (req, res) => {
  const parsed = SignupSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { name, companyName, email, password } = parsed.data;

  const existing = await findUserByEmail(email);
  if (existing) {
    return res.status(409).json({ error: "An account with this email already exists" });
  }

  // Joins an existing company if one with this exact name already
  // exists (e.g. a second teammate signing up), otherwise creates a new
  // tenant. This is the entire multi-tenancy boundary for local signup.
  const company = await findOrCreateCompanyByName(companyName);

  const user = await createUser({ companyId: company.id, name, email, password });

  setSessionCookie(res, {
    id: user.id,
    companyId: user.companyId,
    email: user.email,
    name: user.name,
  });

  return res.status(201).json({
    user: { id: user.id, email: user.email, name: user.name, companyName: company.name },
  });
});

router.post("/login-password", async (req, res) => {
  const parsed = LoginSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      error: "Invalid input",
      details: parsed.error.flatten().fieldErrors,
    });
  }

  const { email, password } = parsed.data;

  const user = await findUserByEmail(email);
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const valid = await verifyPassword(user, password);
  if (!valid) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  setSessionCookie(res, {
    id: user.id,
    companyId: user.companyId,
    email: user.email,
    name: user.name,
  });

  return res.json({
    user: { id: user.id, email: user.email, name: user.name },
  });
});

export default router;
