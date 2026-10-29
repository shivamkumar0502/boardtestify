import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/study-plan";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "study-plan-fixture-secret-".repeat(4);

const m = await import("../backend/src/models.js");
const { accessToken } = await import("../backend/src/lib.js");

test("personal study plan requires authentication and finalized tagged performance data", async () => {
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
      name: "Study plan fixture",
      email: "study-plan@example.test",
      role: "STUDENT",
      classLevel: "10",
      stream: "GENERAL",
    });
    const url = `http://127.0.0.1:${server.address().port}/api/study-plan`;
    const unauthenticated = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: "en" }),
    });
    assert.equal(unauthenticated.status, 401);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken(user)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ language: "en" }),
    });
    assert.equal(response.status, 422);
    assert.match((await response.json()).message, /finalize a test/i);

    await m.StudyPlan.create({
      userId: String(user._id),
      language: "en",
      plan: {
        title: "Saved plan",
        summary: "Test summary",
        days: [{ day: 1, tasks: [{ goal: "Revise", activity: "READ_CONCEPT", durationMinutes: 20, areaId: "chapter-1" }] }],
      },
      completedTasks: [],
      generatedAt: new Date(),
    });
    const current = await fetch(`${url}/current`, {
      headers: { Authorization: `Bearer ${accessToken(user)}` },
    });
    assert.equal(current.status, 200);
    assert.equal((await current.json()).plan.title, "Saved plan");

    const taskUpdate = await fetch(`${url}/task`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken(user)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ day: 1, taskIndex: 0, completed: true }),
    });
    assert.equal(taskUpdate.status, 200);
    assert.deepEqual((await taskUpdate.json()).completedTasks, ["day:1:task:0"]);

    const uncheck = await fetch(`${url}/task`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken(user)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ day: 1, taskIndex: 0, completed: false }),
    });
    assert.equal(uncheck.status, 200);
    assert.deepEqual((await uncheck.json()).completedTasks, []);
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await db.stop();
  }
});
