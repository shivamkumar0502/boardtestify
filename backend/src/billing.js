import { Router } from "express";
import { z } from "zod";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Plan, Payment, Subscription, Audit } from "./models.js";
import { env } from "./config.js";
import { auth, assert, randomToken } from "./lib.js";
import { boundedJSON, sharedLimit } from "./reliability.js";
import { id } from "@boardtestify/domain";
export const billing = Router();
billing.use(auth);
export const paymentsEnabled = () =>
  !!(
    env.RAZORPAY_KEY_ID &&
    env.RAZORPAY_KEY_SECRET &&
    env.RAZORPAY_WEBHOOK_SECRET
  );
export function validSignature(body, signature, secret) {
  if (!secret || !/^[a-f0-9]{64}$/.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
export async function razor(path, body) {
  assert(paymentsEnabled(), 503, "Payments are not enabled");
  const r = await fetch(`https://api.razorpay.com/v1/${path}`, {
    method: body ? "POST" : "GET",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assert(r.ok, 503, "Payment provider unavailable");
  return boundedJSON(r, 300000);
}
export function entitlementQuery(user) {
  return {
    userId: String(user._id),
    status: "PAID",
    expiresAt: { $gt: new Date() },
    $and: [
      {
        $or: [
          { "plan.classLevels": user.classLevel },
          { plan: { $exists: false } },
        ],
      },
      { $or: [{ "plan.streams": user.stream }, { plan: { $exists: false } }] },
    ],
  };
}
export const hasEntitlement = (user) => Payment.exists(entitlementQuery(user));
async function selectedPlan(planId, user) {
  const plan = await Plan.findOne({
    _id: id.parse(planId),
    active: true,
    classLevels: user.classLevel,
    streams: user.stream,
  }).lean();
  assert(plan, 404, "Plan is not available for your class/stream");
  return plan;
}
export async function confirmOrder(orderId, paymentId) {
  const [payment, order] = await Promise.all([
    razor(`payments/${encodeURIComponent(paymentId)}`),
    Payment.findOne({ orderId }),
  ]);
  assert(
    order &&
      payment.order_id === orderId &&
      payment.status === "captured" &&
      payment.amount === order.amount &&
      payment.currency === "INR",
    400,
    "Payment not captured or does not match order",
  );
  const days = order.plan?.durationDays || 30;
  await Payment.updateOne(
    { _id: order._id, status: "CREATED" },
    {
      $set: {
        status: "PAID",
        paymentId,
        providerCreatedAt: new Date(payment.created_at * 1000),
        expiresAt: new Date(payment.created_at * 1000 + days * 86400000),
      },
    },
  );
}
async function syncSubscription(providerId, paymentId) {
  const row = await Subscription.findOne({ providerId });
  assert(row, 404, "Subscription not found");
  const sub = await razor(`subscriptions/${encodeURIComponent(providerId)}`);
  assert(
    sub.plan_id === row.plan.providerPlanId,
    400,
    "Subscription plan does not match",
  );
  await Subscription.updateOne(
    { _id: row._id },
    {
      $set: {
        status: sub.status,
        currentEnd: sub.current_end ? new Date(sub.current_end * 1000) : null,
        cancelAtCycleEnd: row.cancelAtCycleEnd || !!sub.has_scheduled_changes,
      },
    },
  );
  if (paymentId) {
    const p = await razor(`payments/${encodeURIComponent(paymentId)}`);
    assert(
      p.status === "captured" &&
        p.currency === "INR" &&
        p.amount === row.plan.pricePaise &&
        p.invoice_id,
      400,
      "Subscription payment is not captured",
    );
    const invoice = await razor(`invoices/${encodeURIComponent(p.invoice_id)}`);
    assert(
      invoice.subscription_id === providerId &&
        invoice.payment_id === paymentId,
      400,
      "Invoice does not match this subscription",
    );
    const end = invoice.billing_end ?? sub.current_end;
    assert(
      Number.isInteger(end) && end > p.created_at,
      400,
      "Subscription billing period is missing",
    );
    await Payment.updateOne(
      { orderId: `subscription:${paymentId}` },
      {
        $setOnInsert: {
          userId: row.userId,
          amount: p.amount,
          currency: "INR",
          status: "PAID",
          paymentId,
          subscriptionId: providerId,
          plan: row.plan,
          expiresAt: new Date(end * 1000),
          providerCreatedAt: new Date(p.created_at * 1000),
        },
      },
      { upsert: true },
    );
  }
  return sub;
}
export async function billingWebhook(req, res) {
  assert(env.RAZORPAY_WEBHOOK_SECRET, 503, "Webhook is not configured");
  assert(
    validSignature(
      req.body.toString("utf8"),
      String(req.headers["x-razorpay-signature"] || ""),
      env.RAZORPAY_WEBHOOK_SECRET,
    ),
    400,
    "Invalid webhook signature",
  );
  const event = JSON.parse(req.body.toString("utf8")),
    payment = event.payload?.payment?.entity,
    subscription = event.payload?.subscription?.entity;
  if (
    event.event === "payment.captured" &&
    payment?.order_id &&
    (await Payment.exists({ orderId: payment.order_id }))
  )
    await confirmOrder(payment.order_id, payment.id);
  if (
    event.event?.startsWith("subscription.") &&
    subscription?.id &&
    (await Subscription.exists({ providerId: subscription.id }))
  )
    await syncSubscription(
      subscription.id,
      event.event === "subscription.charged" ? payment?.id : undefined,
    );
  if (event.event === "refund.processed") {
    const refund = event.payload?.refund?.entity;
    assert(refund?.payment_id, 400, "Missing refund payment");
    const p = await razor(`payments/${encodeURIComponent(refund.payment_id)}`);
    if (p.status === "refunded" || p.amount_refunded >= p.amount)
      await Payment.updateMany(
        { paymentId: refund.payment_id },
        { $set: { status: "REFUNDED" } },
      );
  }
  res.json({ ok: true });
}
billing.get("/billing", async (req, res) => {
  const [entitlement, subscriptions, payments] = await Promise.all([
    Payment.findOne(entitlementQuery(req.user))
      .sort({ expiresAt: -1 })
      .select("expiresAt plan.name")
      .lean(),
    Subscription.find({ userId: String(req.user._id) })
      .sort({ createdAt: -1 })
      .limit(20)
      .select("-plan.creator")
      .lean(),
    Payment.find({ userId: String(req.user._id) })
      .sort({ createdAt: -1 })
      .limit(30)
      .select(
        "status amount currency plan.name subscriptionId expiresAt createdAt",
      )
      .lean(),
  ]);
  res.json({ entitlement, subscriptions, payments });
});
billing.post(
  "/billing/order",
  sharedLimit({
    name: "orders",
    limit: 8,
    windowMs: 60000,
    key: (req) => String(req.user._id),
  }),
  async (req, res) => {
    const { planId } = z.object({ planId: id }).parse(req.body);
    const plan = await selectedPlan(planId, req.user);
    assert(
      plan.billingModel === "ONE_TIME",
      400,
      "Choose subscription checkout for this plan",
    );
    const order = await razor("orders", {
      amount: plan.pricePaise,
      currency: "INR",
      receipt: randomToken().slice(0, 32),
    });
    await Payment.create({
      orderId: order.id,
      userId: String(req.user._id),
      amount: plan.pricePaise,
      currency: "INR",
      status: "CREATED",
      plan,
    });
    res.status(201).json({
      orderId: order.id,
      keyId: env.RAZORPAY_KEY_ID,
      amount: plan.pricePaise,
      currency: "INR",
      name: "BoardTestify",
      description: plan.name,
    });
  },
);
billing.post("/billing/verify", async (req, res) => {
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
    validSignature(
      `${d.orderId}|${d.paymentId}`,
      d.signature,
      env.RAZORPAY_KEY_SECRET,
    ),
    400,
    "Invalid payment signature",
  );
  await confirmOrder(d.orderId, d.paymentId);
  res.json({ ok: true });
});
billing.post(
  "/billing/subscriptions",
  sharedLimit({
    name: "subscriptions",
    limit: 5,
    windowMs: 60000,
    key: (req) => String(req.user._id),
  }),
  async (req, res) => {
    const { planId } = z.object({ planId: id }).parse(req.body);
    const plan = await selectedPlan(planId, req.user);
    assert(
      plan.billingModel === "RECURRING" && plan.providerPlanId,
      400,
      "Recurring plan required",
    );
    const actual = await razor(`plans/${plan.providerPlanId}`);
    assert(
      actual.item?.amount === plan.pricePaise &&
        actual.item?.currency === "INR" &&
        actual.period === plan.period &&
        actual.interval === plan.interval,
      400,
      "Provider plan settings do not match",
    );
    const s = await razor("subscriptions", {
      plan_id: plan.providerPlanId,
      total_count: plan.totalCount,
      quantity: 1,
      customer_notify: 1,
      notes: { userId: String(req.user._id), planId: String(plan._id) },
    });
    await Subscription.create({
      providerId: s.id,
      userId: String(req.user._id),
      plan,
      status: s.status,
      cancelAtCycleEnd: false,
    });
    res.status(201).json({
      keyId: env.RAZORPAY_KEY_ID,
      subscriptionId: s.id,
      name: "BoardTestify",
      description: plan.name,
    });
  },
);
billing.post("/billing/subscriptions/verify", async (req, res) => {
  const d = z
    .object({
      subscriptionId: z.string().regex(/^sub_[a-zA-Z0-9]+$/),
      paymentId: z.string().max(100),
      signature: z.string().length(64),
    })
    .parse(req.body);
  assert(
    await Subscription.exists({
      providerId: d.subscriptionId,
      userId: String(req.user._id),
    }),
    404,
    "Subscription not found",
  );
  assert(
    validSignature(
      `${d.paymentId}|${d.subscriptionId}`,
      d.signature,
      env.RAZORPAY_KEY_SECRET,
    ),
    400,
    "Invalid subscription signature",
  );
  const sub = await syncSubscription(d.subscriptionId);
  const p = await razor(`payments/${encodeURIComponent(d.paymentId)}`);
  if (p.status === "captured" && p.invoice_id)
    await syncSubscription(d.subscriptionId, d.paymentId);
  res.json({
    ok: true,
    status: sub.status,
    accessActive: !!(await hasEntitlement(req.user)),
  });
});
billing.post("/billing/subscriptions/:id/cancel", async (req, res) => {
  const providerId = z
    .string()
    .regex(/^sub_[a-zA-Z0-9]+$/)
    .parse(req.params.id);
  assert(
    await Subscription.exists({ providerId, userId: String(req.user._id) }),
    404,
    "Subscription not found",
  );
  const current = await razor(`subscriptions/${providerId}`);
  await razor(`subscriptions/${providerId}/cancel`, {
    cancel_at_cycle_end: current.status === "active" ? 1 : 0,
  });
  await Subscription.updateOne(
    { providerId },
    { $set: { cancelAtCycleEnd: true } },
  );
  const sub = await syncSubscription(providerId);
  await Audit.create({
    actor: String(req.user._id),
    action: "SUBSCRIPTION_CANCEL",
    entityId: providerId,
  });
  res.json({ ok: true, status: sub.status });
});
