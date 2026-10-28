import { packRoutes } from "./pack-routes.js";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ZodError } from "zod";
import pino from "pino";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { env } from "./config.js";
import { HttpError } from "./lib.js";
import { authRouter } from "./auth.js";
import { content } from "./content.js";
import { attempts } from "./attempts.js";
import { integrations, webhook } from "./integrations.js";
import { sharedLimit, concurrencyGate } from "./reliability.js";
import { management } from "./management.js";
import { attachments } from "./attachments.js";
import { billing } from "./billing.js";
import { otp } from "./otp.js";
export const logger = pino({
  redact: ["password", "token", "authorization", "cookie", "studentAnswer"],
});
export const app = express();
app.disable("x-powered-by");
if (env.TRUST_PROXY_HOPS) app.set("trust proxy", env.TRUST_PROXY_HOPS);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        "script-src": ["'self'", "https://checkout.razorpay.com"],
        "img-src": ["'self'", "data:", "https:"],
        "connect-src": ["'self'", env.WEB_ORIGIN, "https://api.razorpay.com"],
        "frame-src": [
          "https://api.razorpay.com",
          "https://checkout.razorpay.com",
        ],
      },
    },
  }),
);
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use((req, res, next) => {
  res.setHeader("X-Request-ID", randomUUID());
  if (req.path.startsWith("/api/")) res.setHeader("Cache-Control", "no-store");
  next();
});
app.post(
  "/api/billing/webhook",
  concurrencyGate(4),
  express.raw({ type: "application/json", limit: "100kb" }),
  webhook,
);
app.use(cookieParser());
app.get("/api/live", (_req, res) => res.json({ ok: true }));
app.use("/api", concurrencyGate(env.API_CONCURRENCY));
app.get("/api/health", (_req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ ok: mongoose.connection.readyState === 1 }),
);
app.use("/api", sharedLimit({ name: "api", limit: 12000, windowMs: 60000 }));
app.use(
  "/api/admin/import",
  concurrencyGate(2),
  express.json({ limit: "3mb" }),
);
app.use(express.json({ limit: "384kb" }));
app.use("/api/auth", authRouter);
app.use("/api/auth", otp);
app.use(
  "/api",
  integrations,
  packRoutes,
  billing,
  content,
  management,
  attachments,
  attempts,
);
const webDist = fileURLToPath(new URL("../../frontend/dist/", import.meta.url));
app.use(
  "/assets",
  express.static(webDist + "assets", { immutable: true, maxAge: "1y" }),
);
app.use(
  express.static(webDist, {
    setHeaders: (res, path) => {
      if (path.endsWith(".html")) res.setHeader("Cache-Control", "no-store");
    },
  }),
);
app.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(webDist + "index.html", (err) => {
    if (err) next();
  });
});
app.use((_req, res) => res.status(404).json({ message: "Endpoint not found" }));
app.use((err, req, res, _next) => {
  const status =
    err instanceof ZodError
      ? 400
      : err instanceof HttpError
        ? err.status
        : err.code === 11000
          ? 409
          : err.name === "VersionError"
            ? 409
            : err.type === "entity.too.large"
              ? 413
              : [
                    "MongoNotConnectedError",
                    "MongoServerSelectionError",
                    "MongoNetworkError",
                    "MongoNetworkTimeoutError",
                    "MongoWaitQueueTimeoutError",
                  ].includes(err.name) ||
                  err.code === 50 ||
                  /buffering timed out/.test(err.message || "")
                ? 503
                : err.code === "LIMIT_FILE_SIZE"
                  ? 413
                  : err.name === "MulterError" ||
                      String(err.code || "").startsWith("CSV_")
                    ? 400
                    : err instanceof SyntaxError
                      ? 400
                      : 500;
  const message =
    err instanceof ZodError
      ? "Validation failed"
      : err instanceof HttpError
        ? err.message
        : status === 409
          ? "Record already exists or changed; reload"
          : status === 413
            ? "Upload too large"
            : status === 400
              ? "Invalid JSON"
              : status === 503
                ? "Service temporarily unavailable. Please retry."
                : "Something went wrong";
  if (status === 500)
    logger.error(
      { err, requestId: res.getHeader("X-Request-ID"), path: req.path },
      "Request failed",
    );
  if (status === 503 && !res.hasHeader("Retry-After"))
    res.setHeader("Retry-After", "3");
  res.status(status).json({
    message,
    details:
      err instanceof ZodError
        ? err.flatten()
        : err instanceof HttpError
          ? err.details
          : undefined,
  });
});
