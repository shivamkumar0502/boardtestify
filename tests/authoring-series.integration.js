import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import mongoose from "mongoose";
import sharp from "sharp";
import { MongoMemoryServer } from "mongodb-memory-server";
process.env.NODE_ENV = "test";
process.env.DB_IP_FAMILY = "4";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/pending";
process.env.JWT_SECRET = "authoring-series-fixture-".repeat(4);
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.S3_BUCKET = "test";
process.env.S3_REGION = "us-east-1";
process.env.S3_ACCESS_KEY_ID = "test";
process.env.S3_SECRET_ACCESS_KEY = "test";
process.env.AI_API_KEY = "test-only";
process.env.AI_MODEL = "test-vision";
process.env.AI_VISION_ENABLED = "true";
process.env.AI_BASE_URL = "https://import-provider.example/v1";
let db,
  server,
  storage,
  m,
  base,
  owner,
  other,
  student,
  adminToken,
  otherToken,
  studentToken,
  reviewerToken,
  academic;
let calls = [],
  failAI = false;
const objects = new Map(),
  realFetch = global.fetch;
const pasted = "1. Compute 2 + 3.\nA) 4\nB) 5\nC) 6\nD) 7\nAnswer: B";
before(async () => {
  storage = http
    .createServer(async (req, res) => {
      const key = new URL(req.url, "http://local").pathname;
      if (req.method === "PUT") {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        objects.set(key, Buffer.concat(chunks));
        res.writeHead(200, { ETag: '"test"' });
        return res.end();
      }
      if (req.method === "DELETE") {
        objects.delete(key);
        res.statusCode = 204;
        return res.end();
      }
      const bytes = objects.get(key);
      if (!bytes) {
        res.statusCode = 404;
        return res.end();
      }
      res.writeHead(200, {
        "Content-Length": bytes.length,
        "Content-Type": "image/jpeg",
      });
      res.end(bytes);
    })
    .listen(0, "127.0.0.1");
  await new Promise((r) => storage.once("listening", r));
  process.env.S3_ENDPOINT = `http://127.0.0.1:${storage.address().port}`;
  db = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  m = await import("../backend/src/models.js");
  await m.connect(db.getUri());
  assert.equal(mongoose.connection.getClient().options.family, 4);
  const { app } = await import("../backend/src/app.js");
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}/api`;
  const users = await m.User.create(
    ["ADMIN", "CONTENT_EDITOR", "STUDENT", "ADMIN"].map((role, i) => ({
      name: role,
      email: `authoring-${i}@example.com`,
      role,
      classLevel: "10",
      stream: "GENERAL",
    })),
  );
  [owner, other, student] = users;
  const { accessToken } = await import("../backend/src/lib.js");
  [adminToken, otherToken, studentToken, reviewerToken] =
    users.map(accessToken);
  const subject = await m.Academic.create({
    kind: "SUBJECT",
    name: "Import fixture mathematics",
    session: "2026-27",
    classLevel: "10",
    stream: "GENERAL",
    active: true,
  });
  academic = {
    subjectId: String(subject._id),
    session: "2026-27",
    classLevel: "10",
    stream: "GENERAL",
  };
  global.fetch = async (url, options) => {
    if (String(url).startsWith("https://import-provider.example/")) {
      if (failAI) return new Response("{}", { status: 503 });
      calls.push(JSON.parse(options.body));
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  questions: [
                    {
                      type: "SINGLE_CHOICE",
                      text: "Visible photo question: 2 + 3?",
                      options: [
                        { id: "a", text: "4" },
                        { id: "b", text: "5" },
                      ],
                      correct: [],
                      maximumMarks: 1,
                      academic: { subjectId: "malicious" },
                      isPYQ: true,
                    },
                  ],
                  warnings: ["No visible answer key"],
                }),
              },
            },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }
    return realFetch(url, options);
  };
});
after(async () => {
  global.fetch = realFetch;
  await new Promise((r) => server?.close(r) || r());
  await new Promise((r) => storage?.close(r) || r());
  await mongoose.disconnect();
  await db?.stop();
});
async function call(path, body, token = adminToken) {
  const r = await realFetch(base + path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: r.status, data: await r.json() };
}
async function photo(token = adminToken, buffer) {
  const form = new FormData();
  form.append(
    "meta",
    JSON.stringify({
      academic,
      sourceTitle: "Owned book page fixture",
      language: "en",
    }),
  );
  form.append(
    "file",
    new Blob(
      [
        buffer ||
          (await sharp({
            create: { width: 30, height: 30, channels: 3, background: "white" },
          })
            .png()
            .toBuffer()),
      ],
      { type: "image/png" },
    ),
    "page.png",
  );
  const r = await realFetch(base + "/admin/question-imports/photo", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: r.status, data: await r.json() };
}

test("photo extraction queues privately, keeps unknown keys editable and saves only reviewed idempotent drafts", async () => {
  assert.equal((await photo(studentToken)).status, 403);
  assert.equal(
    (await photo(adminToken, Buffer.from("fake image"))).status,
    400,
  );
  const queued = await photo();
  assert.equal(queued.status, 202);
  const jobId = queued.data.id;
  assert.equal(
    (await call(`/admin/question-imports/${jobId}`, undefined, otherToken))
      .status,
    404,
  );
  const { authoringTick, cleanupAuthoringJobs } =
    await import("../backend/src/authoring-jobs.js");
  await authoringTick();
  let job = (await call(`/admin/question-imports/${jobId}`)).data;
  assert.equal(job.status, "READY");
  assert.equal(job.result.questions.length, 1);
  assert.ok(calls[0].messages[1].content.some((x) => x.type === "image_url"));
  const q = job.result.questions[0];
  assert.equal(q.academic.subjectId, academic.subjectId);
  assert.equal(q.isPYQ, false);
  assert.deepEqual(q.correct, []);
  const payload = {
    title: "Reviewed worksheet",
    durationMinutes: 15,
    questions: [q],
  };
  assert.equal(
    (await call(`/admin/question-imports/${jobId}/commit`, payload)).status,
    400,
  );
  assert.equal((await m.AuthoringJob.findById(jobId)).commitInput, undefined);
  payload.questions[0].correct = ["b"];
  const saved = await call(`/admin/question-imports/${jobId}/commit`, payload);
  assert.equal(saved.status, 200);
  assert.equal(saved.data.status, "DRAFT");
  assert.equal((await m.TestModel.findById(saved.data.testId)).status, "DRAFT");
  const questions = await m.QuestionModel.find({ creator: String(owner._id) });
  assert.equal(questions.length, 1);
  assert.equal(questions[0].status, "DRAFT");
  assert.equal(questions[0].originJobId, jobId);
  const reviewSource = await call(
    `/admin/question-imports/${jobId}`,
    undefined,
    reviewerToken,
  );
  assert.equal(reviewSource.status, 200);
  assert.equal(reviewSource.data.canEdit, false);
  assert.ok(reviewSource.data.sourceURL);
  assert.equal(
    (
      await call(
        `/admin/question-imports/${jobId}/commit`,
        payload,
        reviewerToken,
      )
    ).status,
    404,
  );
  assert.equal(
    await m.Audit.countDocuments({
      action: "QUESTION_IMPORT_SAVE",
      entityId: saved.data.testId,
    }),
    1,
  );

  assert.equal(
    (await call(`/admin/questions/${questions[0]._id}/publish`, {})).status,
    400,
  );
  assert.equal(
    (await call(`/admin/question-imports/${jobId}/commit`, payload)).data
      .testId,
    saved.data.testId,
  );
  assert.equal(
    await m.QuestionModel.countDocuments({ creator: String(owner._id) }),
    1,
  );
  assert.equal(
    (await call(`/tests/${saved.data.testId}/start`, {}, studentToken)).status,
    404,
  );
  await m.AuthoringJob.updateOne(
    { _id: jobId },
    { $set: { deleteAfter: new Date(Date.now() - 1000) } },
  );
  await cleanupAuthoringJobs();
  assert.equal(await m.AuthoringJob.findById(jobId), null);
  assert.equal(objects.size, 0);
  assert.ok(await m.TestModel.findById(saved.data.testId));
});
test("paste queue is bounded, worker leases recover, failures preserve source and saves resume frozen input", async () => {
  const input = {
    academic,
    language: "en",
    sourceTitle: "Own pasted worksheet",
    text: pasted,
  };
  const jobs = [];
  for (let i = 0; i < 3; i++) {
    const r = await call("/admin/question-imports/text", input, otherToken);
    assert.equal(r.status, 202);
    jobs.push(r.data.id);
  }
  assert.equal(
    (await call("/admin/question-imports/text", input, otherToken)).status,
    429,
  );
  const { authoringTick } = await import("../backend/src/authoring-jobs.js");
  while (await authoringTick()) {}
  const j = await m.AuthoringJob.findById(jobs[0]);
  assert.equal(j.status, "READY");
  assert.equal(j.result.questions[0].correct[0], "b");
  // A frozen first save can be retried, even when the client no longer holds that payload.
  await m.AuthoringJob.updateOne(
    { _id: j._id },
    {
      $set: {
        commitInput: {
          title: "Frozen save",
          durationMinutes: 10,
          questions: j.result.questions,
        },
      },
    },
  );
  const frozen = await call(
    `/admin/question-imports/${j._id}/commit`,
    {},
    otherToken,
  );
  assert.equal(frozen.status, 200);
  assert.equal(
    (await m.TestModel.findById(frozen.data.testId)).data.title,
    "Frozen save",
  );
  const interrupted = await m.AuthoringJob.create({
    ownerId: String(other._id),
    slot: 0,
    status: "PROCESSING",
    method: "TEXT",
    input: { ...input, method: "TEXT" },
    attempts: 1,
    leaseToken: "old-token",
    leaseUntil: new Date(Date.now() - 1000),
    deleteAfter: new Date(Date.now() + 60000),
  });
  await authoringTick();
  assert.equal(
    (await m.AuthoringJob.findById(interrupted._id)).status,
    "READY",
  );
  assert.equal(
    (
      await m.AuthoringJob.updateOne(
        { _id: interrupted._id, leaseToken: "old-token" },
        { $set: { status: "FAILED" } },
      )
    ).matchedCount,
    0,
  );
  failAI = true;
  const bad = await photo();
  await authoringTick();
  failAI = false;
  const failed = (await call(`/admin/question-imports/${bad.data.id}`)).data;
  assert.equal(failed.status, "FAILED");
  assert.ok(failed.sourceURL);
  assert.equal(
    (await call(`/admin/question-imports/${bad.data.id}/retry`, {})).status,
    200,
  );
  await authoringTick();
  assert.equal((await m.AuthoringJob.findById(bad.data.id)).status, "READY");
});
test("series discovery scopes publication/class and paginates without answer keys, with resume/result state", async () => {
  const ids = await m.TestModel.insertMany(
    Array.from({ length: 23 }, (_, i) => ({
      status: i === 22 ? "DRAFT" : "PUBLISHED",
      data: {
        title: i === 0 ? "literal .* title" : `Series fixture ${i}`,
        academic,
        mode: "PRACTICE",
        premium: i % 2 === 0,
        durationMinutes: 15,
        sections: [{ id: "s", questionIds: ["private-answer-id"] }],
      },
    })),
  );
  const chapter = await m.Academic.create({
    kind: "CHAPTER",
    name: "Teacher supplied chapter",
    parentId: academic.subjectId,
    ...academic,
    active: true,
  });
  await m.TestModel.updateOne(
    { _id: ids[0]._id },
    { $set: { "data.academic.chapterId": String(chapter._id) } },
  );
  const outsider = await m.Academic.create({
    kind: "SUBJECT",
    name: "Other class",
    session: "2026-27",
    classLevel: "12",
    stream: "ARTS",
    active: true,
  });
  await m.TestModel.create({
    status: "PUBLISHED",
    data: {
      title: "Other class hidden",
      academic: {
        ...academic,
        subjectId: String(outsider._id),
        classLevel: "12",
        stream: "ARTS",
      },
    },
  });
  let series = await call("/test-series", undefined, studentToken);
  assert.equal(series.status, 200);
  assert.equal(series.data.length, 1);
  assert.equal(series.data[0].testCount, 22);
  await m.Attempt.create({
    userId: String(student._id),
    testId: String(ids[0]._id),
    status: "ACTIVE",
    startedAt: new Date(),
    deadline: new Date(Date.now() + 60000),
  });
  await m.Attempt.create({
    userId: String(student._id),
    testId: String(ids[1]._id),
    status: "SUBMITTED",
    startedAt: new Date(),
    submittedAt: new Date(),
    summary: {},
  });
  const page = await call(
    `/test-series/${academic.subjectId}/tests`,
    undefined,
    studentToken,
  );
  assert.equal(page.data.rows.length, 20);
  assert.ok(page.data.nextCursor);
  assert.ok(!JSON.stringify(page.data).includes("private-answer-id"));
  const page2 = await call(
    `/test-series/${academic.subjectId}/tests?cursor=${page.data.nextCursor}`,
    undefined,
    studentToken,
  );
  assert.equal(page2.data.rows.length, 2);
  assert.equal(page2.data.nextCursor, null);
  const all = [...page.data.rows, ...page2.data.rows];
  assert.equal(new Set(all.map((t) => t.id)).size, 22);
  assert.ok(all.find((t) => t.id === String(ids[0]._id)).activeAttemptId);
  assert.ok(all.find((t) => t.id === String(ids[1]._id)).resultAttemptId);
  const scopedChapter = await call(
    `/test-series/${academic.subjectId}/tests?chapterId=${chapter._id}`,
    undefined,
    studentToken,
  );
  assert.equal(scopedChapter.data.rows.length, 1);
  assert.equal(
    scopedChapter.data.chapters[0].title,
    "Teacher supplied chapter",
  );
  const literal = await call(
    `/test-series/${academic.subjectId}/tests?q=${encodeURIComponent(".*")}`,
    undefined,
    studentToken,
  );
  assert.equal(literal.data.rows.length, 1);
  assert.ok(
    (
      await call(
        `/test-series/${academic.subjectId}/tests?access=FREE`,
        undefined,
        studentToken,
      )
    ).data.rows.every((t) => !t.premium),
  );
  assert.equal(
    (await call(`/test-series/${outsider._id}/tests`, undefined, studentToken))
      .status,
    404,
  );
  assert.equal(
    (
      await call(
        `/test-series/${academic.subjectId}/tests?cursor=bad`,
        undefined,
        studentToken,
      )
    ).status,
    400,
  );
});
