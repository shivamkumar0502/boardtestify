import { createHash } from "node:crypto";
import { RateBucket } from "./models.js";
import { HttpError } from "./lib.js";
// Atomic shared windows work across Node replicas without a required Redis service.
export function sharedLimit({ name, limit, windowMs, key = (req) => req.ip }) {
  return async (req, res, next) => {
    try {
      if (
        process.env.DISABLE_RATE_LIMITS === "test-only" &&
        process.env.NODE_ENV === "test"
      )
        return next();
      const now = Date.now(),
        bucket = Math.floor(now / windowMs);
      const identity = createHash("sha256")
        .update(String(key(req)))
        .digest("hex");
      const query = { _id: `${name}:${bucket}:${identity}` };
      let row;
      try {
        row = await RateBucket.findOneAndUpdate(
          query,
          {
            $inc: { count: 1 },
            $setOnInsert: { expiresAt: new Date((bucket + 2) * windowMs) },
          },
          { upsert: true, returnDocument: "after" },
        );
      } catch (e) {
        if (e.code !== 11000) throw e;
        row = await RateBucket.findOneAndUpdate(
          query,
          { $inc: { count: 1 } },
          { returnDocument: "after" },
        );
      }
      if (row.count > limit) {
        res.setHeader(
          "Retry-After",
          Math.ceil(((bucket + 1) * windowMs - now) / 1000),
        );
        throw new HttpError(
          429,
          "Too many requests. Please try again shortly.",
        );
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}
export function concurrencyGate(limit) {
  let active = 0;
  return (req, res, next) => {
    if (active >= limit) {
      res.setHeader("Retry-After", "3");
      return next(new HttpError(503, "Server is busy. Please retry shortly."));
    }
    active++;
    let released = false;
    const release = () => {
      if (!released) {
        released = true;
        active--;
      }
    };
    res.once("finish", release);
    res.once("close", release);
    next();
  };
}
export async function boundedJSON(response, maxBytes = 2_000_000) {
  const reader = response.body?.getReader();
  if (!reader) throw new HttpError(502, "Empty provider response");
  let total = 0,
    chunks = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        await reader.cancel();
        throw new HttpError(502, "Provider response is too large");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(502, "Provider returned invalid JSON");
  }
}
