import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
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
export const logger = pino({
  redact: ["password", "token", "authorization", "cookie", "studentAnswer"],
});
export const app = express();
app.disable("x-powered-by");
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
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.post(
  "/api/billing/webhook",
  express.raw({ type: "application/json", limit: "100kb" }),
  webhook,
);
app.use(express.json({ limit: "3mb" }));
app.use(cookieParser());
app.use(
  rateLimit({
    windowMs: 60000,
    limit: 240,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);
app.get("/api/health", (_req, res) =>
  res
    .status(mongoose.connection.readyState === 1 ? 200 : 503)
    .json({ ok: mongoose.connection.readyState === 1 }),
);
app.use("/api/auth", authRouter);
app.use("/api", integrations, content, attempts);
const webDist = fileURLToPath(new URL("../../web/dist/", import.meta.url));
app.use(express.static(webDist));
app.get("/{*path}", (req, res, next) => {
  if (req.path.startsWith("/api/")) return next();
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
              : "Something went wrong";
  if (status === 500)
    logger.error(
      { err, requestId: res.getHeader("X-Request-ID"), path: req.path },
      "Request failed",
    );
  res
    .status(status)
    .json({
      message,
      details:
        err instanceof ZodError
          ? err.flatten()
          : err instanceof HttpError
            ? err.details
            : undefined,
    });
});
