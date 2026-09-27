import type { Request, NextFunction, Response } from "express";
import { readSessionCookie, SessionUser } from "./cookie";

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const user = readSessionCookie(req);

  if (!user) {
    return res.status(401).json({ error: "Unauthenticated" });
  }

  req.user = user;
  next();
}
