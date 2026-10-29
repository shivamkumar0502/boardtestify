import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/streak";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "study-streak-fixture-secret-".repeat(4);

const m = await import("../backend/src/models.js");
const { accessToken } = await import("../backend/src/lib.js");

test("analytics returns current, longest and seven-day streak using India time", async () => {
  const db = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  let server;
  try {
    await m.connect(db.getUri());
    const { app } = await import("../backend/src/app.js");
    server = app.listen(0, "127.0.0.1");
    await new Promise((resolve) => server.once("listening", resolve));
    const user = await m.User.create({
      name: "Streak fixture",
      email: "streak@example.test",
      role: "STUDENT",
      classLevel: "10",
      stream: "GENERAL",
    });
    const key = (offset) => {
      const now = new Date();
      const local = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      const [year, month, day] = local.split("-").map(Number);
      return new Date(Date.UTC(year, month - 1, day + offset, 12))
        .toISOString().slice(0, 10);
    };
    const dayAt = (offset) => new Date(`${key(offset)}T10:00:00+05:30`);
    await m.Attempt.create([
      { userId: String(user._id), testId: "today", status: "SUBMITTED", submittedAt: dayAt(0), snapshot: { title: "Today" }, questions: [], summary: { provisional: false, maximumMarks: 1, awardedMarks: 1 } },
      { userId: String(user._id), testId: "yesterday", status: "SUBMITTED", submittedAt: dayAt(-1), snapshot: { title: "Yesterday" }, questions: [], summary: { provisional: false, maximumMarks: 1, awardedMarks: 1 } },
      { userId: String(user._id), testId: "older", status: "SUBMITTED", submittedAt: dayAt(-5), snapshot: { title: "Older" }, questions: [], summary: { provisional: false, maximumMarks: 1, awardedMarks: 1 } },
    ]);
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/analytics/detailed`,
      { headers: { Authorization: `Bearer ${accessToken(user)}` } },
    );
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.streak.current, 2);
    assert.equal(data.streak.longest, 2);
    assert.equal(data.streak.activeDays.length, 7);
    assert.deepEqual(
      data.streak.activeDays.map((day) => day.active),
      [false, true, false, false, false, true, true],
    );
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await db.stop();
  }
});
