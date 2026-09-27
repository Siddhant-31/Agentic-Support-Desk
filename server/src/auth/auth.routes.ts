import ScalekitClient, { AuthenticationResponse } from "@scalekit-sdk/node";
import { Router } from "express";
import crypto from "crypto";
import { clearSessionCookie, setSessionCookie } from "./cookie";
import { requireAuth } from "./auth.middleware";
import { findOrCreateCompanyByDomain } from "../support/companies.store";
import { findOrCreateSsoUser } from "./users.store";

const router = Router();

function extractEnv(key: string) {
  const getVal = process.env[key];

  if (!getVal) throw new Error(`Missing env, ${getVal}`);

  return getVal;
}

function makeScalekit() {
  return new ScalekitClient(
    extractEnv("SCALEKIT_ENVIRONMENT_URL"),
    extractEnv("SCALEKIT_CLIENT_ID"),
    extractEnv("SCALEKIT_CLIENT_SECRET"),
  );
}

function getQueryString(value: unknown) {
  if (typeof value === "string") return value;
  return undefined;
}

function stateCookieOptions() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
    maxAge: 20 * 60 * 1000,
  };
}

router.get("/login", (req, res) => {
  try {
    const scalekit = makeScalekit();

    const state = crypto.randomBytes(16).toString("hex");
    res.cookie("sp_oauth_state", state, stateCookieOptions());

    const redirectUri = `${extractEnv("BACKEND_URL")}/auth/callback`;
    const authorizationUrl = scalekit.getAuthorizationUrl(redirectUri, {
      scopes: ["openid", "profile", "email"],
      state,
    });

    res.redirect(authorizationUrl);
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
});

router.get("/callback", async (req, res) => {
  try {
    const code = getQueryString(req.query.code);
    const state = getQueryString(req.query.state);
    const error = getQueryString(req.query.error);

    if (error) {
      return res.redirect(
        `${extractEnv("FRONTEND_URL")}/login=${encodeURIComponent(error)}`,
      );
    }

    if (!code || !state) {
      return res.status(400).send("Missing code/state");
    }

    const expectedState = req.cookies?.["sp_oauth_state"];
    if (!expectedState || expectedState !== state) {
      return res.status(400).send("Invalid state!!!");
    }

    res.clearCookie("sp_oauth_state", stateCookieOptions());

    const scalekit = makeScalekit();
    const redirectUri = `${extractEnv("BACKEND_URL")}/auth/callback`;

    const authResult: AuthenticationResponse =
      await scalekit.authenticateWithCode(code, redirectUri);

    console.log(authResult, code, "authResult");

    if (!authResult.user) {
      return res.status(500).send("user info is missing");
    }

    // SSO doesn't collect a company name explicitly, so infer the tenant
    // from the user's email domain - everyone at the same company lands
    // in the same tenant automatically, and this also gives us a real
    // company-scoped user row (with a real DB id) rather than trusting
    // whatever id ScaleKit happens to report.
    const company = await findOrCreateCompanyByDomain(authResult.user.email);
    const user = await findOrCreateSsoUser({
      companyId: company.id,
      name: authResult.user.name ?? authResult.user.email,
      email: authResult.user.email,
    });

    setSessionCookie(res, {
      id: user.id,
      companyId: user.companyId,
      email: user.email,
      name: user.name,
    });

    return res.redirect(`${extractEnv("FRONTEND_URL")}/support`);
  } catch (e) {
    res.status(500).json({
      success: false,
      message: "Error",
    });
  }
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user!.id,
      companyId: req.user!.companyId,
      email: req.user!.email,
      name: req.user!.name,
    },
  });
});

router.post("/logout", (req, res) => {
  clearSessionCookie(res);

  res.json({ ok: true });
});

export default router;
