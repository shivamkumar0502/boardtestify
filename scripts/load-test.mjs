// Isolated, disposable local benchmark. This script never uses a production URI.
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { performance, monitorEventLoopDelay } from "node:perf_hooks";
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "local-load-test-only-secret-".repeat(3);
process.env.WEB_ORIGIN = "http://localhost:5173";
const students = Math.min(
  200,
  Math.max(1, Number(process.env.LOAD_STUDENTS || 50)),
);
const concurrent = Math.min(
  students,
  Math.max(1, Number(process.env.LOAD_CONCURRENCY || 20)),
);
const db = await MongoMemoryServer.create({
  instance: { args: ["--nounixsocket"] },
});
process.env.MONGODB_URI = db.getUri();
const m = await import("../backend/src/models.js");
await m.connect(process.env.MONGODB_URI);
const { app } = await import("../backend/src/app.js");
const { accessToken } = await import("../backend/src/lib.js");
const servers = [app.listen(0, "127.0.0.1"), app.listen(0, "127.0.0.1")];
await Promise.all(
  servers.map((s) => new Promise((r) => s.once("listening", r))),
);
const bases = servers.map((s) => `http://127.0.0.1:${s.address().port}/api`);
const subject = await m.Academic.create({
  kind: "SUBJECT",
  name: "Synthetic mathematics",
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
const questions = await m.QuestionModel.create(
  Array.from({ length: 10 }, (_, i) => ({
    hash: `load-${i}`,
    data: {
      academic,
      type: "SINGLE_CHOICE",
      language: "en",
      text: `Original load fixture ${i + 1}: 2 + 2 = ?`,
      options: [
        { id: "a", text: "4" },
        { id: "b", text: "5" },
      ],
      correct: ["a"],
      maximumMarks: 1,
      negativeMarks: 0,
      rubric: [],
      explanation: "2 + 2 = 4",
      source: "Synthetic benchmark fixture",
    },
    status: "PUBLISHED",
    version: 1,
    creator: "fixture",
    reviewer: "fixture",
  })),
);
const exam = await m.TestModel.create({
  data: {
    title: "Synthetic concurrency test",
    academic,
    mode: "CBT",
    durationMinutes: 30,
    sections: [
      {
        id: "a",
        title: "Objective",
        questionIds: questions.map((q) => String(q._id)),
      },
    ],
  },
  status: "PUBLISHED",
  version: 1,
});
const users = await m.User.create(
  Array.from({ length: students }, (_, i) => ({
    name: `Synthetic ${i}`,
    email: `load-${i}@example.com`,
    passwordHash: "not-a-login-account",
    role: "STUDENT",
    classLevel: "10",
    stream: "GENERAL",
  })),
);
const durations = [],
  errors = [];
let requests = 0,
  cursor = 0;
const lag = monitorEventLoopDelay({ resolution: 10 });
lag.enable();
const started = performance.now();
async function request(i, path, body, method) {
  const t = performance.now();
  const r = await fetch(bases[i % 2] + path, {
    method: method || "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken(users[i])}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await r.json();
  requests++;
  durations.push(performance.now() - t);
  if (!r.ok) throw Error(`${r.status}: ${data.message}`);
  return data;
}
async function student(i) {
  try {
    const a = await request(i, `/tests/${exam._id}/start`, {});
    for (const q of questions)
      await request(
        i,
        `/attempts/${a.id}/answer`,
        {
          questionId: String(q._id),
          version: 0,
          value: ["a"],
          visited: true,
          review: false,
        },
        "PUT",
      );
    await request(i, `/attempts/${a.id}/submit`, {});
  } catch (e) {
    errors.push({ student: i, message: e.message });
  }
}
try {
  await Promise.all(
    Array.from({ length: concurrent }, async () => {
      while (cursor < students) {
        const i = cursor++;
        await student(i);
      }
    }),
  );
  const elapsed = (performance.now() - started) / 1000;
  durations.sort((a, b) => a - b);
  const completed = await m.Attempt.countDocuments({
    status: "SUBMITTED",
    "summary.awardedMarks": 10,
    "summary.maximumMarks": 10,
    answeredIds: { $size: 10 },
  });
  const report = {
    scenario:
      "Synthetic 10-MCQ exam, two HTTP listeners, one Node process and local MongoDB; no external AI/OCR/payment calls",
    students,
    concurrentStudentFlows: concurrent,
    requests,
    elapsedSeconds: Number(elapsed.toFixed(2)),
    requestsPerSecond: Number((requests / elapsed).toFixed(1)),
    p50Milliseconds: Number(
      (durations[Math.floor(durations.length * 0.5)] || 0).toFixed(1),
    ),
    p95Milliseconds: Number(
      (durations[Math.floor(durations.length * 0.95)] || 0).toFixed(1),
    ),
    maxEventLoopDelayMilliseconds: Number((lag.max / 1e6).toFixed(1)),
    completedWithAllAnswersAndCorrectScores: completed,
    errors,
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length || completed !== students) process.exitCode = 1;
} finally {
  lag.disable();
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  await mongoose.disconnect();
  await db.stop();
}
