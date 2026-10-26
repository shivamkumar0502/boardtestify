import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-only-secret-".repeat(5);
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/uninitialized";
let mongo, server, base, models;
before(async () => {
  if (process.env.TEST_MONGODB_URI) {
    process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
  } else {
    mongo = await MongoMemoryServer.create({
      instance: { args: ["--nounixsocket"] },
    });
    process.env.MONGODB_URI = mongo.getUri();
  }
  models = await import("../apps/api/src/models.js");
  await models.connect(process.env.MONGODB_URI);
  await mongoose.connection.dropDatabase();
  await Promise.all(
    [models.User, models.Attempt, models.Payment, models.QuestionModel].map(
      (m) => m.createIndexes(),
    ),
  );
  const { app } = await import("../apps/api/src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.on("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => {
  await new Promise((r) => (server ? server.close(() => r()) : r()));
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});
async function call(path, body, token, method) {
  const res = await fetch(base + path, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, data: await res.json() };
}
test("persistent authentication, publication, CBT conflict/timer, scoring and review workflow", async () => {
  const password = "A-secure-test-password-123";
  const registered = await call("/auth/register", {
    name: "Test Student",
    email: "student@example.com",
    password,
    classLevel: "10",
    stream: "GENERAL",
    role: "SUPER_ADMIN",
  });
  assert.equal(registered.status, 201);
  assert.equal(registered.data.user.role, "STUDENT");
  const token = registered.data.token;
  const userId = registered.data.user.id;
  assert.equal((await call("/admin/questions", undefined, token)).status, 403);
  assert.equal((await call("/tests")).status, 401);
  assert.equal((await call("/features")).status, 200);
  const login = await call("/auth/login", {
    email: "student@example.com",
    password,
  });
  assert.equal(login.status, 200);
  assert.equal(
    (
      await call("/auth/login", {
        email: "student@example.com",
        password: "wrong-password",
      })
    ).status,
    401,
  );
  const admin = await models.User.create({
    name: "Admin",
    email: "admin@example.com",
    passwordHash: "unused",
    role: "ADMIN",
    classLevel: "10",
    stream: "GENERAL",
  });
  const { accessToken } = await import("../apps/api/src/lib.js");
  const adminToken = accessToken(admin);
  const subject = await models.Academic.create({
    kind: "SUBJECT",
    name: "Sample mathematics",
    session: "2026-27",
    classLevel: "10",
    stream: "GENERAL",
    active: true,
  });
  const academic = {
    session: "2026-27",
    classLevel: "10",
    stream: "GENERAL",
    subjectId: String(subject._id),
  };
  const question = {
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
  const created = await call("/admin/questions", question, adminToken);
  assert.equal(created.status, 201);
  const qid = created.data._id;
  assert.equal(
    (await call(`/admin/questions/${qid}/publish`, {}, adminToken)).status,
    400,
  );
  const reviewer = await models.User.create({
    name: "Reviewer",
    email: "reviewer@example.com",
    passwordHash: "unused",
    role: "ADMIN",
    classLevel: "10",
    stream: "GENERAL",
  });
  const reviewToken = accessToken(reviewer);
  assert.equal(
    (await call(`/admin/questions/${qid}/publish`, {}, reviewToken)).status,
    200,
  );
  const desc = await call(
    "/admin/questions",
    {
      ...question,
      type: "SHORT_ANSWER",
      text: "Solve 3x = 15 and explain.",
      options: [],
      correct: [],
      maximumMarks: 3,
      referenceAnswer: "Divide by 3. x = 5.",
      rubric: [
        { id: "method", name: "Division", maximumMarks: 2 },
        { id: "result", name: "Answer", maximumMarks: 1 },
      ],
    },
    adminToken,
  );
  assert.equal(desc.status, 201);
  const did = desc.data._id;
  assert.equal(
    (await call(`/admin/questions/${did}/publish`, {}, reviewToken)).status,
    200,
  );
  const t = await call(
    "/admin/tests",
    {
      title: "CBT test",
      academic,
      mode: "CBT",
      durationMinutes: 30,
      sections: [{ id: "s", title: "Section", questionIds: [qid, did] }],
    },
    adminToken,
  );
  assert.equal(t.status, 201);
  const tid = t.data._id;
  assert.equal(
    (await call(`/admin/tests/${tid}/publish`, {}, reviewToken)).status,
    200,
  );
  const start = await call(`/tests/${tid}/start`, {}, token);
  assert.equal(start.status, 201);
  const aid = start.data.id;
  assert.equal(start.data.questions[0].correct, undefined);
  assert.equal(start.data.questions[1].referenceAnswer, undefined);
  const deadline = start.data.deadline;
  assert.equal((await call(`/tests/${tid}/start`, {}, token)).data.id, aid);
  assert.equal(
    (await call(`/attempts/${aid}`, undefined, token)).data.deadline,
    deadline,
  );
  assert.equal(
    (await call(`/attempts/${aid}/result`, undefined, token)).status,
    409,
  );
  const answer = {
    questionId: qid,
    version: 0,
    value: ["a"],
    visited: true,
    review: false,
  };
  assert.equal(
    (await call(`/attempts/${aid}/answer`, answer, token, "PUT")).status,
    200,
  );
  assert.equal(
    (
      await call(
        `/attempts/${aid}/answer`,
        { ...answer, value: ["b"] },
        token,
        "PUT",
      )
    ).status,
    409,
  );
  const other = await call("/auth/register", {
    name: "Other Student",
    email: "other@example.com",
    password,
    classLevel: "10",
    stream: "GENERAL",
  });
  assert.equal(
    (await call(`/attempts/${aid}`, undefined, other.data.token)).status,
    404,
  );
  await call(
    `/attempts/${aid}/answer`,
    {
      questionId: did,
      version: 0,
      value: "Divide both sides by 3, so x = 5.",
      visited: true,
      review: true,
    },
    token,
    "PUT",
  );
  // Mutating the question bank cannot change a started attempt's marks or answers.
  await models.QuestionModel.updateOne(
    { _id: qid },
    { $set: { "data.correct": ["b"], "data.maximumMarks": 99 } },
  );
  const submitted = await call(`/attempts/${aid}/submit`, {}, token);
  assert.equal(submitted.status, 200);
  assert.equal((await call(`/attempts/${aid}/submit`, {}, token)).status, 200);
  assert.equal(
    (
      await call(
        `/attempts/${aid}/answer`,
        { ...answer, version: 1 },
        token,
        "PUT",
      )
    ).status,
    409,
  );
  let result = await call(`/attempts/${aid}/result`, undefined, token);
  assert.equal(result.data.awardedMarks, 1);
  assert.equal(result.data.maximumMarks, 4);
  assert.equal(result.data.provisional, true);
  const { tick } = await import("../apps/api/src/attempts.js");
  await tick();
  const record = await models.Attempt.findById(aid);
  assert.equal(record.evaluations[did].status, "REVIEW");
  assert.equal(record.evaluations[did].awardedMarks, null);
  const reviewed = await call(
    `/reviews/${aid}`,
    {
      questionId: did,
      revision: record.revision,
      reason: "Checked the method and final answer against the rubric.",
      criteria: [
        { id: "method", awardedMarks: 2, feedback: "Correct division" },
        { id: "result", awardedMarks: 1, feedback: "Correct answer" },
      ],
    },
    reviewToken,
  );
  assert.equal(reviewed.status, 200);
  result = await call(`/attempts/${aid}/result`, undefined, token);
  assert.equal(result.data.provisional, false);
  assert.equal(result.data.awardedMarks, 4);
  const next = await call(`/tests/${tid}/start`, {}, token);
  const expiredId = next.data.id;
  await models.Attempt.updateOne(
    { _id: expiredId },
    { $set: { deadline: new Date(Date.now() - 1000) } },
  );
  assert.equal(
    (await call(`/attempts/${expiredId}/answer`, answer, token, "PUT")).status,
    409,
  );
  assert.equal(
    (await call(`/attempts/${expiredId}`, undefined, token)).data.status,
    "EXPIRED",
  );
  assert.equal((await call("/analytics", undefined, token)).data.completed, 2);
  // Payment replay/signature handling is independent from frontend checkout success.
  const { validHmac } = await import("../apps/api/src/integrations.js");
  assert.equal(validHmac("{}", "forged", "secret"), false);
  assert.equal(
    (
      await call(
        "/billing/verify",
        { orderId: "fake", paymentId: "fake", signature: "a".repeat(64) },
        token,
      )
    ).status,
    404,
  );
  const mobile = await call("/auth/mobile-login", {
    email: "student@example.com",
    password,
  });
  assert.equal(mobile.status, 200);
  const refreshed = await call("/auth/mobile-refresh", {
    refreshToken: mobile.data.refreshToken,
  });
  assert.equal(refreshed.status, 200);
  assert.equal(
    (
      await call("/auth/mobile-refresh", {
        refreshToken: mobile.data.refreshToken,
      })
    ).status,
    401,
  );
});
