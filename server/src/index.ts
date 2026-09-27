import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRouter from "./auth/auth.routes";
import authE2ERouter from "./auth/e2e.routes";
import authLocalRouter from "./auth/local.routes";
import supportRouter from "./support/support.routes";
import { requireAuth } from "./auth/auth.middleware";

async function main() {
  dotenv.config();

  const app = express();

  app.use(
    cors({
      origin: process.env.FRONTEND_URL!,
      credentials: true,
    }),
  );

  app.use(express.json());
  app.use(cookieParser());

  app.get("/status", (req, res) => {
    res.json({
      ok: true,
      status: "UP",
    });
  });

  app.use("/auth", authRouter);
  app.use("/auth", authE2ERouter);
  app.use("/auth", authLocalRouter);

  //protect
  app.use("/api", requireAuth);
  app.use("/api/support", supportRouter);

  const port = Number(process.env.PORT || 5000);

  app.listen(port, () => {
    console.log("Server is running on port 5000");
  });
}

main().catch((err) => {
  console.error("Server error occured");
  process.exit(1);
});
