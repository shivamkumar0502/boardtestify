import { Router } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { env } from "./config.js";
import { auth, assert, allow, randomToken, HttpError } from "./lib.js";
import { Payment } from "./models.js";
export const integrations = Router();
export function validHmac(body, signature, secret) {
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return (
    !!secret &&
    /^[a-f0-9]{64}$/.test(signature) &&
    timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  );
}
async function razor(path, body) {
  assert(
    env.RAZORPAY_KEY_ID && env.RAZORPAY_KEY_SECRET,
    503,
    "Payments are not enabled",
  );
  const r = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new HttpError(503, "Payment provider unavailable");
  return r.json();
}
async function confirmCaptured(orderId, paymentId) {
  const p = await razor(`payments/${encodeURIComponent(paymentId)}`);
  const order = await Payment.findOne({ orderId });
  assert(
    order &&
      p.order_id === orderId &&
      p.status === "captured" &&
      p.amount === order.amount &&
      p.currency === "INR",
    400,
    "Payment not captured or does not match order",
  );
  await Payment.updateOne(
    { _id: order._id, status: "CREATED" },
    {
      $set: {
        status: "PAID",
        paymentId,
        expiresAt: new Date(p.created_at * 1000 + 30 * 86400000),
      },
    },
  );
}
// Must be mounted before express.json() to verify the exact bytes.
export async function webhook(req, res) {
  assert(env.RAZORPAY_WEBHOOK_SECRET, 503, "Webhook is not configured");
  assert(
    validHmac(
      req.body.toString("utf8"),
      String(req.headers["x-razorpay-signature"] || ""),
      env.RAZORPAY_WEBHOOK_SECRET,
    ),
    400,
    "Invalid webhook signature",
  );
  const event = JSON.parse(req.body.toString("utf8"));
  if (event.event === "payment.captured") {
    const p = event.payload?.payment?.entity;
    assert(
      p && typeof p.id === "string" && typeof p.order_id === "string",
      400,
      "Invalid payment event",
    );
    await confirmCaptured(p.order_id, p.id);
  }
  res.json({ ok: true });
}
integrations.get("/features", (_req, res) =>
  res.json({
    ai: !!(env.AI_API_KEY && env.AI_MODEL),
    payments: !!(
      env.RAZORPAY_KEY_ID &&
      env.RAZORPAY_KEY_SECRET &&
      env.RAZORPAY_WEBHOOK_SECRET
    ),
    storage: !!env.S3_BUCKET,
    passwordReset: !!env.SMTP_URL,
    passPricePaise: env.PASS_PRICE_PAISE,
  }),
);
integrations.use(auth);
integrations.get("/billing", async (req, res) =>
  res.json({
    entitlement: await Payment.findOne({
      userId: String(req.user._id),
      status: "PAID",
      expiresAt: { $gt: new Date() },
    })
      .sort({ expiresAt: -1 })
      .select("expiresAt")
      .lean(),
  }),
);
integrations.post("/billing/order", async (req, res) => {
  assert(env.RAZORPAY_WEBHOOK_SECRET, 503, "Payments are not enabled");
  const order = await razor("orders", {
    amount: env.PASS_PRICE_PAISE,
    currency: "INR",
    receipt: randomToken().slice(0, 32),
  });
  await Payment.create({
    orderId: order.id,
    userId: String(req.user._id),
    amount: env.PASS_PRICE_PAISE,
    currency: "INR",
    status: "CREATED",
  });
  res
    .status(201)
    .json({
      orderId: order.id,
      keyId: env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: "INR",
      name: "BoardTestify",
      description: "30-day study pass",
    });
});
integrations.post("/billing/verify", async (req, res) => {
  const d = z
    .object({
      orderId: z.string().max(100),
      paymentId: z.string().max(100),
      signature: z.string().length(64),
    })
    .parse(req.body);
  assert(
    await Payment.exists({ orderId: d.orderId, userId: String(req.user._id) }),
    404,
    "Order missing",
  );
  assert(
    validHmac(
      `${d.orderId}|${d.paymentId}`,
      d.signature,
      env.RAZORPAY_KEY_SECRET,
    ),
    400,
    "Invalid payment signature",
  );
  await confirmCaptured(d.orderId, d.paymentId);
  res.json({ ok: true });
});
integrations.post(
  "/uploads",
  allow("CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    const d = z
      .object({
        mime: z.enum(["image/jpeg", "image/png", "image/webp"]),
        size: z
          .number()
          .int()
          .min(1)
          .max(5 * 1024 * 1024),
      })
      .parse(req.body);
    assert(
      env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
      503,
      "Storage is not configured",
    );
    const client = new S3Client({
      endpoint: env.S3_ENDPOINT || undefined,
      region: env.S3_REGION,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
      },
    });
    const key = `question-images/${randomToken()}.${d.mime.split("/")[1]}`;
    res.json({
      key,
      ...(await createPresignedPost(client, {
        Bucket: env.S3_BUCKET,
        Key: key,
        Expires: 300,
        Fields: { "Content-Type": d.mime },
        Conditions: [
          ["content-length-range", 1, d.size],
          ["eq", "$Content-Type", d.mime],
        ],
      })),
    });
  },
);
