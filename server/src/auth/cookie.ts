import { Response } from "express";
import * as jwt from "jsonwebtoken";

export type SessionUser = {
  id: string;
  companyId: string;
  email: string;
  name?: string;
};

function cookieOptions() {
  const isProd = process.env.NODE_ENV === "production";

  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookie(res: Response, user: SessionUser) {
  const token = jwt.sign(user, process.env.SESSION_JWT_SECRET!, {
    algorithm: "HS256",
    expiresIn: "7d",
  });

  res.cookie(process.env.SESSION_COOKIE_NAME!, token, {
    ...cookieOptions(),
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(process.env.SESSION_COOKIE_NAME!, cookieOptions());
}

export function readSessionCookie(req: { cookies?: Record<string, string> }) {
  const token = req.cookies?.[process.env.SESSION_COOKIE_NAME!];

  if (!token) return null;

  try {
    const decoded = jwt.verify(
      token,
      process.env.SESSION_JWT_SECRET!,
    ) as SessionUser;
    return decoded;
  } catch {
    return null;
  }
}
