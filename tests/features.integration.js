import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createHmac } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import sharp from "sharp";
import express from "express";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "readiness-only-secret-".repeat(4);
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/pending";
process.env.S3_BUCKET = "test";
process.env.S3_REGION = "us-east-1";
process.env.S3_ACCESS_KEY_ID = "test";
process.env.S3_SECRET_ACCESS_KEY = "test";
process.env.OCR_API_KEY = "test";
process.env.AI_API_KEY = "test";
process.env.AI_MODEL = "mock";
process.env.AI_VISION_ENABLED = "true";
process.env.TWILIO_ACCOUNT_SID = "ACtest";
process.env.TWILIO_AUTH_TOKEN = "test";
process.env.TWILIO_VERIFY_SERVICE_SID = "VAtest";
process.env.RAZORPAY_KEY_ID = "rzp_test";
process.env.RAZORPAY_KEY_SECRET = "test-payment-secret";
process.env.RAZORPAY_WEBHOOK_SECRET = "test-webhook-secret";
let db, server, s3, base, m, token, otherToken, adminToken, reviewToken;
const files = new Map();
const realFetch = global.fetch;
let aiCalls = [],
  failAI = false,
  refunded = false,
  cancelled = false;
const now = Math.floor(Date.now() / 1000),
  periodEnd = now + 30 * 86400;
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
before(async () => {
  s3 = http.createServer(async (req, res) => {
    const key = new URL(req.url, "http://local").pathname;
    if (req.method === "PUT") {
      const parts = [];
      for await (const p of req) parts.push(p);
      files.set(key, Buffer.concat(parts));
      res.writeHead(200, { ETag: '"test"' });
      return res.end();
    }
    if (req.method === "DELETE") {
      files.delete(key);
      res.statusCode = 204;
      return res.end();
    }
    const bytes = files.get(key);
    if (!bytes) {
      res.statusCode = 404;
      return res.end();
    }
    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Content-Length": bytes.length,
    });
    res.end(bytes);
  });
  s3.listen(0, "127.0.0.1");
  await new Promise((r) => s3.once("listening", r));
  process.env.S3_ENDPOINT = `http://127.0.0.1:${s3.address().port}`;
  db = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  process.env.MONGODB_URI = db.getUri();
  m = await import("../backend/src/models.js");
  await m.connect(process.env.MONGODB_URI);
  const { app } = await import("../backend/src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  global.fetch = async (url, options = {}) => {
    const str = String(url);
    if (str.startsWith("https://verify.twilio.com/")) {
      if (str.endsWith("/Verifications"))
        return json({ sid: "VEtest", status: "pending" });
      const body = new URLSearchParams(options.body);
      return json({
        status: body.get("Code") === "123456" ? "approved" : "pending",
      });
    }
    if (str.startsWith("https://vision.googleapis.com/"))
      return json({
        responses: [
          {
            fullTextAnnotation: {
              text: "Divide by 3. x = 5.",
              pages: [
                {
                  blocks: [{ paragraphs: [{ words: [{ confidence: 0.96 }] }] }],
                },
              ],
            },
          },
        ],
      });
    if (str.endsWith("/chat/completions")) {
      if (failAI) return json({ error: "outage" }, 503);
      aiCalls.push(JSON.parse(options.body));
      return json({
        choices: [
          {
            message: {
              content: JSON.stringify({
                confidence: 0.95,
                detectedLanguage: "en",
                criteria: [
                  { id: "method", awardedMarks: 2, feedback: "Correct method" },
                  { id: "result", awardedMarks: 1, feedback: "Correct result" },
                ],
                strengths: ["Correct division"],
                missingPoints: [],
                errors: [],
                improvementAdvice: [],
                requiresManualReview: false,
                reviewReason: null,
              }),
            },
          },
        ],
      });
    }
    if (str.startsWith("https://api.razorpay.com/v1/")) {
      const path = str.split("/v1/")[1];
      if (path === "orders")
        return json({ id: "order_mock", amount: 9900, currency: "INR" });
      if (path === "plans/plan_mock")
        return json({
          item: { amount: 9900, currency: "INR" },
          period: "monthly",
          interval: 1,
        });
      if (path === "subscriptions" && options.method === "POST")
        return json({ id: "sub_mock", status: "created" });
      if (path === "subscriptions/sub_mock/cancel") {
        cancelled = true;
        return json({ id: "sub_mock", status: "active" });
      }
      if (path === "subscriptions/sub_mock")
        return json({
          id: "sub_mock",
          plan_id: "plan_mock",
          status: cancelled ? "cancelled" : "active",
          current_end: periodEnd,
          has_scheduled_changes: cancelled,
        });
      if (path.startsWith("payments/")) {
        const pay = path.slice(9);
        return json({
          id: pay,
          status: refunded ? "refunded" : "captured",
          amount: 9900,
          amount_refunded: refunded ? 9900 : 0,
          currency: "INR",
          created_at: now,
          order_id: pay === "pay_once" ? "order_mock" : "order_sub",
          invoice_id: pay === "pay_sub" ? "inv_mock" : null,
        });
      }
      if (path === "invoices/inv_mock")
        return json({
          subscription_id: "sub_mock",
          payment_id: "pay_sub",
          billing_end: periodEnd,
        });
      return json({}, 404);
    }
    return realFetch(url, options);
  };
  const { accessToken } = await import("../backend/src/lib.js");
  const users = await m.User.create([
    {
      name: "Student",
      email: "feature@example.com",
      passwordHash: "unused",
      classLevel: "10",
      stream: "GENERAL",
      role: "STUDENT",
    },
    {
      name: "Other",
      email: "other-feature@example.com",
      passwordHash: "unused",
      classLevel: "10",
      stream: "GENERAL",
      role: "STUDENT",
    },
    {
      name: "Author",
      email: "author-feature@example.com",
      passwordHash: "unused",
      classLevel: "10",
      stream: "GENERAL",
      role: "ADMIN",
    },
    {
      name: "Reviewer",
      email: "review-feature@example.com",
      passwordHash: "unused",
      classLevel: "10",
      stream: "GENERAL",
      role: "ADMIN",
    },
  ]);
  [token, otherToken, adminToken, reviewToken] = users.map(accessToken);
});
after(async () => {
  global.fetch = realFetch;
  await new Promise((r) => server?.close(r) || r());
  await new Promise((r) => s3?.close(r) || r());
  await mongoose.disconnect();
  if (db) await db.stop();
});
async function call(path, body, access = token, method) {
  const r = await realFetch(base + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${access}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
let subject, qid, did, tid;
test("authoring, approval, announcements and pattern enforcement work end to end", async () => {
  let r = await call(
    "/admin/academics",
    {
      kind: "SUBJECT",
      name: "Original mathematics",
      session: "2026-27",
      classLevel: "10",
      stream: "GENERAL",
      syllabusVersion: "1",
    },
    adminToken,
  );
  subject = r.data._id;
  assert.equal(r.status, 201);
  const academic = {
    session: "2026-27",
    classLevel: "10",
    stream: "GENERAL",
    subjectId: subject,
  };
  const q = {
    academic,
    type: "SINGLE_CHOICE",
    language: "en",
    text: "What is 2 + 2?",
    options: [
      { id: "a", text: "4" },
      { id: "b", text: "5" },
    ],
    correct: ["a"],
    maximumMarks: 1,
    source: "Original practice",
  };
  r = await call("/admin/questions", q, adminToken);
  qid = r.data._id;
  assert.equal(r.status, 201);
  await call(`/admin/questions/${qid}/publish`, {}, reviewToken);
  r = await call(
    "/admin/questions",
    {
      ...q,
      type: "SHORT_ANSWER",
      text: "Solve 3x = 15 with a diagram if useful.",
      options: [],
      correct: [],
      referenceAnswer: "Divide by 3, giving x = 5.",
      maximumMarks: 3,
      rubric: [
        { id: "method", name: "Method", maximumMarks: 2 },
        { id: "result", name: "Result", maximumMarks: 1 },
      ],
    },
    adminToken,
  );
  did = r.data._id;
  assert.equal(r.status, 201);
  await call(`/admin/questions/${did}/publish`, {}, reviewToken);
  r = await call(
    "/admin/tests",
    {
      title: "Immediate practice",
      academic,
      mode: "PRACTICE",
      feedbackMode: "IMMEDIATE",
      durationMinutes: null,
      sections: [{ id: "s", title: "Practice", questionIds: [qid, did] }],
    },
    adminToken,
  );
  tid = r.data._id;
  assert.equal(r.status, 201);
  assert.equal(
    (await call(`/admin/tests/${tid}/publish`, {}, reviewToken)).status,
    200,
  );
  assert.equal(
    (
      await call(
        "/admin/announcements",
        {
          title: "Revision class",
          body: "Practise linear equations today.",
          language: "en",
          classLevel: "10",
          stream: "GENERAL",
          published: true,
          startsAt: new Date(Date.now() - 1000).toISOString(),
        },
        adminToken,
      )
    ).status,
    201,
  );
  assert.equal((await call("/announcements")).data.length, 1);
  assert.equal((await call("/admin/plans", {}, token)).status, 403);
  const pattern = {
    title: "Illustrative source-checked configuration",
    academic,
    versionLabel: "test",
    officialSource: "https://biharboardonline.com/modelpapermatric.html",
    verifiedAt: new Date().toISOString(),
    durationMinutes: 20,
    totalMarks: 1,
    sections: [
      {
        id: "s",
        title: "Objective",
        offered: 1,
        answerCount: 1,
        marksEach: 1,
        types: ["SINGLE_CHOICE"],
      },
    ],
  };
  r = await call("/admin/patterns", pattern, adminToken);
  assert.equal(r.status, 201);
  const pid = r.data._id;
  assert.equal(
    (await call(`/admin/patterns/${pid}/publish`, {}, adminToken)).status,
    400,
  );
  assert.equal(
    (await call(`/admin/patterns/${pid}/publish`, {}, reviewToken)).status,
    200,
  );
  r = await call(
    "/admin/tests",
    {
      title: "Invalid board pattern",
      academic,
      mode: "BOARD",
      durationMinutes: 30,
      patternId: pid,
      officialSource: pattern.officialSource,
      verifiedAt: pattern.verifiedAt,
      sections: [{ id: "s", title: "Objective", questionIds: [qid] }],
    },
    adminToken,
  );
  assert.equal(
    (await call(`/admin/tests/${r.data._id}/publish`, {}, reviewToken)).status,
    400,
  );
});
test("answer photos are validated, private, OCR/vision evaluated, and never silently finalized by AI", async () => {
  const started = await call(`/tests/${tid}/start`, {});
  const aid = started.data.id;
  let r = await call(
    `/attempts/${aid}/answer`,
    { questionId: qid, value: ["b"], version: 0, visited: true, review: false },
    token,
    "PUT",
  );
  assert.equal(r.status, 200);
  assert.equal(r.data.feedback.correct[0], "a");
  assert.equal(r.data.feedback.awardedMarks, 0);
  const fake = new FormData();
  fake.append("questionId", did);
  fake.append(
    "file",
    new Blob(["<svg>fake image</svg>"], { type: "image/png" }),
    "fake.png",
  );
  let uploaded = await realFetch(base + `/attempts/${aid}/sheets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: fake,
  });
  assert.equal(uploaded.status, 400);
  const png = await sharp({
    create: { width: 60, height: 60, channels: 3, background: "#fff" },
  })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append("questionId", did);
  form.append("file", new Blob([png], { type: "image/png" }), "answer.png");
  uploaded = await realFetch(base + `/attempts/${aid}/sheets`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  assert.equal(uploaded.status, 201);
  const asset = await uploaded.json();
  assert.equal(
    (await call(`/attachments/${asset.id}`, undefined, otherToken)).status,
    404,
  );
  assert.equal((await call(`/attachments/${asset.id}`)).status, 200);
  r = await call(
    `/attempts/${aid}/answer`,
    {
      questionId: did,
      value: "",
      version: 0,
      visited: true,
      review: false,
      attachmentIds: [asset.id],
    },
    token,
    "PUT",
  );
  assert.equal(r.status, 200);
  assert.equal((await call(`/attempts/${aid}/submit`, {})).status, 200);
  const { tick } = await import("../backend/src/attempts.js");
  await tick();
  const result = await call(`/attempts/${aid}/result`);
  assert.equal(result.data.provisional, true);
  assert.equal(result.data.evaluations[did].status, "REVIEW");
  assert.equal(result.data.evaluations[did].awardedMarks, 3);
  assert.equal(aiCalls.length, 1);
  assert.equal(Array.isArray(aiCalls[0].messages[1].content), true);
  assert.ok(aiCalls[0].messages[1].content.some((x) => x.type === "image_url"));
  const stored = await m.Attachment.findById(asset.id);
  assert.equal(stored.status, "OCR_COMPLETE");
  assert.match(stored.text, /x = 5/);
  const retried = await call(`/attempts/${aid}/retry`, { filter: "INCORRECT" });
  assert.equal(retried.status, 201);
  assert.equal(retried.data.questions.length, 1);
  assert.equal(retried.data.questions[0]._id, qid);
  await call(`/attempts/${retried.data.id}/submit`, {});
  const untouched = await call(`/attempts/${retried.data.id}/retry`, {
    filter: "UNANSWERED",
  });
  assert.equal(untouched.status, 201);
  assert.equal(untouched.data.questions.length, 1);
  await call(`/attempts/${untouched.data.id}/submit`, {});
  const next = await call(`/tests/${tid}/start`, {});
  await call(
    `/attempts/${next.data.id}/answer`,
    {
      questionId: did,
      value: "x = 5",
      version: 0,
      visited: true,
      review: false,
    },
    token,
    "PUT",
  );
  await call(`/attempts/${next.data.id}/submit`, {});
  failAI = true;
  await tick();
  failAI = false;
  const failed = await call(`/attempts/${next.data.id}/result`);
  assert.equal(failed.data.evaluations[did].status, "REVIEW");
  assert.equal(failed.data.evaluations[did].awardedMarks, null);
});
test("OTP link/login needs provider approval, checks attempt limits, and consumes challenges once", async () => {
  let r = await call("/auth/otp/request", {
    phone: "+919876543210",
    purpose: "LINK",
  });
  assert.equal(r.status, 202);
  const challenge = r.data.challengeId;
  r = await call("/auth/otp/check", { challengeId: challenge, code: "000000" });
  assert.equal(r.status, 400);
  r = await call("/auth/otp/check", { challengeId: challenge, code: "123456" });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.phoneVerified, true);
  assert.equal(
    (await call("/auth/otp/check", { challengeId: challenge, code: "123456" }))
      .status,
    400,
  );
  r = await call("/auth/otp/request", {
    phone: "+919876543211",
    purpose: "LOGIN",
  });
  assert.equal(r.status, 202);
  assert.equal(
    (
      await call("/auth/otp/check", {
        challengeId: r.data.challengeId,
        code: "123456",
        client: "MOBILE",
      })
    ).status,
    400,
  );
});
test("captured payments, subscription renewal, cancellation and refund replay preserve entitlements", async () => {
  let r = await call(
    "/admin/plans",
    {
      name: "One-time plan",
      pricePaise: 9900,
      durationDays: 30,
      billingModel: "ONE_TIME",
      classLevels: ["10"],
      streams: ["GENERAL"],
    },
    adminToken,
  );
  assert.equal(r.status, 201);
  const planId = r.data._id;
  r = await call("/billing/order", { planId });
  assert.equal(r.status, 201);
  const signature = createHmac("sha256", "test-payment-secret")
    .update("order_mock|pay_once")
    .digest("hex");
  assert.equal(
    (
      await call(
        "/billing/verify",
        { orderId: "order_mock", paymentId: "pay_once", signature },
        otherToken,
      )
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/billing/verify", {
        orderId: "order_mock",
        paymentId: "pay_once",
        signature,
      })
    ).status,
    200,
  );
  const expiry = (await call("/billing")).data.entitlement.expiresAt;
  await call("/billing/verify", {
    orderId: "order_mock",
    paymentId: "pay_once",
    signature,
  });
  assert.equal((await call("/billing")).data.entitlement.expiresAt, expiry);
  r = await call(
    "/admin/plans",
    {
      name: "Monthly plan",
      pricePaise: 9900,
      durationDays: 30,
      billingModel: "RECURRING",
      providerPlanId: "plan_mock",
      period: "monthly",
      interval: 1,
      totalCount: 12,
      classLevels: ["10"],
      streams: ["GENERAL"],
    },
    adminToken,
  );
  assert.equal(r.status, 201);
  r = await call("/billing/subscriptions", { planId: r.data._id });
  assert.equal(r.status, 201);
  const sig = createHmac("sha256", "test-payment-secret")
    .update("pay_sub|sub_mock")
    .digest("hex");
  assert.equal(
    (
      await call("/billing/subscriptions/verify", {
        subscriptionId: "sub_mock",
        paymentId: "pay_sub",
        signature: sig,
      })
    ).status,
    200,
  );
  assert.equal(
    await m.Payment.countDocuments({ subscriptionId: "sub_mock" }),
    1,
  );
  assert.equal(
    (await call("/billing/subscriptions/sub_mock/cancel", {})).status,
    200,
  );
  assert.equal(!!(await call("/billing")).data.entitlement, true);
  refunded = true;
  const event = JSON.stringify({
    event: "refund.processed",
    payload: { refund: { entity: { payment_id: "pay_sub" } } },
  });
  const hmac = createHmac("sha256", "test-webhook-secret")
    .update(event)
    .digest("hex");
  const wh = await realFetch(base + "/billing/webhook", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-razorpay-signature": hmac,
    },
    body: event,
  });
  assert.equal(wh.status, 200);
  assert.equal(
    (await m.Payment.findOne({ subscriptionId: "sub_mock" })).status,
    "REFUNDED",
  );
  assert.equal(
    (
      await realFetch(base + "/billing/webhook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-razorpay-signature": "fake",
        },
        body: event,
      })
    ).status,
    400,
  );
});
test("reading periods, first-in-paper choice rules and concurrent answer revisions are enforced", async () => {
  const original = await m.TestModel.findById(tid);
  const second = await m.QuestionModel.create({
    data: {
      ...(await m.QuestionModel.findById(qid)).data,
      text: "Original second MCQ",
    },
    hash: "second-mcq",
    status: "PUBLISHED",
    version: 1,
  });
  const exam = await m.TestModel.create({
    data: {
      ...original.data,
      title: "Choice policy fixture",
      mode: "CBT",
      feedbackMode: "AFTER_SUBMISSION",
      durationMinutes: 20,
      readingMinutes: 1,
      sections: [
        {
          id: "s",
          title: "Choose one",
          questionIds: [qid, String(second._id)],
          maxAnswers: 1,
          choicePolicy: "FIRST_IN_PAPER",
        },
      ],
    },
    status: "PUBLISHED",
    version: 1,
  });
  let r = await call(`/tests/${exam._id}/start`, {});
  const aid = r.data.id;
  assert.equal(
    (
      await call(
        `/attempts/${aid}/answer`,
        {
          questionId: qid,
          value: ["b"],
          version: 0,
          review: false,
          visited: true,
        },
        token,
        "PUT",
      )
    ).status,
    400,
  );
  await m.Attempt.updateOne(
    { _id: aid },
    { $set: { readUntil: new Date(Date.now() - 1000) } },
  );
  const raced = await Promise.all([
    call(
      `/attempts/${aid}/answer`,
      {
        questionId: qid,
        value: ["b"],
        version: 0,
        review: false,
        visited: true,
      },
      token,
      "PUT",
    ),
    call(
      `/attempts/${aid}/answer`,
      {
        questionId: qid,
        value: ["a"],
        version: 0,
        review: false,
        visited: true,
      },
      token,
      "PUT",
    ),
  ]);
  assert.deepEqual(raced.map((r) => r.status).sort(), [200, 409]);
  const a = await m.Attempt.findById(aid);
  assert.equal(a.answers[qid].version, 1);
  assert.equal(
    (
      await call(
        `/attempts/${aid}/answer`,
        {
          questionId: String(second._id),
          value: ["a"],
          version: 0,
          review: false,
          visited: true,
        },
        token,
        "PUT",
      )
    ).status,
    200,
  );
  await call(`/attempts/${aid}/submit`, {});
  r = await call(`/attempts/${aid}/result`);
  assert.equal(r.data.evaluations[String(second._id)].status, "NOT_COUNTED");
  assert.equal(r.data.maximumMarks, 1);
});
test("shared rate windows and overload gates work across listeners and release capacity", async () => {
  const { sharedLimit, concurrencyGate } =
    await import("../backend/src/reliability.js");
  const make = () => {
    const tiny = express();
    tiny.get(
      "/limit",
      sharedLimit({ name: "fixture-limit", limit: 2, windowMs: 60000 }),
      (_req, res) => res.json({ ok: true }),
    );
    tiny.get("/slow", concurrencyGate(2), async (_req, res) => {
      await new Promise((r) => setTimeout(r, 100));
      res.json({ ok: true });
    });
    tiny.use((e, _req, res, _next) =>
      res.status(e.status || 500).json({ message: e.message }),
    );
    return tiny;
  };
  const nodes = [make().listen(0, "127.0.0.1"), make().listen(0, "127.0.0.1")];
  await Promise.all(
    nodes.map((s) => new Promise((r) => s.once("listening", r))),
  );
  const urls = nodes.map((s) => `http://127.0.0.1:${s.address().port}`);
  try {
    assert.equal((await realFetch(urls[0] + "/limit")).status, 200);
    assert.equal((await realFetch(urls[1] + "/limit")).status, 200);
    const throttled = await realFetch(urls[1] + "/limit");
    assert.equal(throttled.status, 429);
    assert.ok(throttled.headers.get("retry-after"));
    const burst = await Promise.all(
      Array.from({ length: 8 }, () => realFetch(urls[0] + "/slow")),
    );
    assert.equal(burst.filter((r) => r.status === 200).length, 2);
    assert.equal(burst.filter((r) => r.status === 503).length, 6);
    assert.equal((await realFetch(urls[0] + "/slow")).status, 200);
  } finally {
    await Promise.all(nodes.map((s) => new Promise((r) => s.close(r))));
  }
});
test("an interrupted evaluation lease is recoverable and old lease tokens cannot commit", async () => {
  const question = await m.QuestionModel.findById(did);
  const user = await m.User.findOne({ email: "feature@example.com" });
  const a = await m.Attempt.create({
    userId: String(user._id),
    testId: tid,
    testVersion: 1,
    status: "SUBMITTED",
    startedAt: new Date(),
    submittedAt: new Date(),
    snapshot: {
      title: "Lease recovery",
      sections: [{ id: "s", questionIds: [did] }],
    },
    questions: [{ ...question.data, _id: did, version: 1, sectionId: "s" }],
    answers: {
      [did]: { value: "Divide by 3, x = 5", version: 1, visited: true },
    },
    evaluations: {
      [did]: { status: "PENDING", awardedMarks: null, maximumMarks: 3 },
    },
    evaluationState: "PENDING",
    leaseToken: "old-worker",
    leaseUntil: new Date(Date.now() + 60000),
  });
  const { tick } = await import("../backend/src/attempts.js");
  await tick();
  assert.equal(
    (await m.Attempt.findById(a._id)).evaluations[did].status,
    "PENDING",
  );
  await m.Attempt.updateOne(
    { _id: a._id },
    { $set: { leaseUntil: new Date(Date.now() - 1000) } },
  );
  await tick();
  assert.equal(
    (await m.Attempt.findById(a._id)).evaluations[did].status,
    "EVALUATED",
  );
  const stale = await m.Attempt.updateOne(
    { _id: a._id, leaseToken: "old-worker" },
    { $set: { evaluationState: "COMPLETE" } },
  );
  assert.equal(stale.matchedCount, 0);
});
test("database failure makes readiness/unavailable APIs fail closed while liveness survives", async () => {
  await mongoose.disconnect();
  assert.equal((await realFetch(base + "/health")).status, 503);
  assert.equal((await realFetch(base + "/live")).status, 200);
  const unavailable = await realFetch(base + "/tests", {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(unavailable.status, 503);
  await m.connect(process.env.MONGODB_URI);
  assert.equal((await realFetch(base + "/health")).status, 200);
  assert.ok((await m.Attempt.countDocuments({ status: "SUBMITTED" })) > 0);
});
