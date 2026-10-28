import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/pending";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "practice-packs-fixture-".repeat(4);
const m = await import("../backend/src/models.js");
const { accessToken } = await import("../backend/src/lib.js");
const { originalPracticePacks } =
  await import("../backend/src/practice-packs.js");
const { questionSchema } = await import("@boardtestify/domain");
test("original practice calculations and options are consistent across 80 bilingual questions", () => {
  const packs = originalPracticePacks();
  assert.equal(packs.length, 8);
  for (const p of packs)
    for (const [index, q] of p.questions.entries()) {
      const i = index + 1;
      assert.equal(new Set(q.options.map((o) => o.text)).size, 4);
      assert.ok(q.translation.length > 0);
      const right = q.options.find((o) => q.correct.includes(o.id)).text;
      const expected = p.id.includes("linear")
        ? i + 1
        : p.id.includes("quadratic")
          ? 2 * i + 3
          : p.id.includes("circles")
            ? 154 * i * i
            : p.id.includes("current")
              ? i + 1
              : p.id.includes("parallel-capacitance")
                ? 2 * i + 7
                : p.id.includes("series-capacitance")
                  ? 2 * i
                  : p.id.includes("profit-sharing")
                    ? 1000 * (i + 1)
                    : null;
      if (expected !== null) assert.equal(Number(right), expected);
    }
});
test("pack import requires admin, creates only drafts, is idempotent and preserves reviewed records", async () => {
  const db = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  let server;
  try {
    await m.connect(db.getUri());
    const { app } = await import("../backend/src/app.js");
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const users = await m.User.create(
      ["STUDENT", "CONTENT_EDITOR", "ADMIN"].map((role, i) => ({
        name: role,
        email: `pack-${i}@example.com`,
        role,
        classLevel: "10",
        stream: "GENERAL",
      })),
    );
    const tokens = users.map(accessToken),
      url = `http://127.0.0.1:${server.address().port}/api/admin/practice-packs`;
    const call = async (token, body) => {
      const r = await fetch(url + (body ? "/import" : ""), {
        method: body ? "POST" : "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { status: r.status, data: await r.json() };
    };
    assert.equal((await call(tokens[0])).status, 403);
    assert.equal(
      (await call(tokens[1], { packId: "original-v1" })).status,
      403,
    );
    assert.equal((await call(tokens[2])).data.length, 6);
    assert.equal((await call(tokens[2], { packId: "made-up" })).status, 400);
    assert.equal(
      (await call(tokens[2], { packId: "bseb-2026" })).data.questions,
      15,
    );
    const imported = await call(tokens[2], { packId: "original-v1" });
    assert.equal(imported.status, 200);
    assert.equal(imported.data.questions, 80);
    assert.equal(
      await m.QuestionModel.countDocuments({ status: "PUBLISHED" }),
      0,
    );
    assert.equal(await m.TestModel.countDocuments({ status: "DRAFT" }), 13);
    const publicTests = await fetch(
      `http://127.0.0.1:${server.address().port}/api/tests`,
      { headers: { Authorization: `Bearer ${tokens[0]}` } },
    );
    assert.equal(publicTests.status, 200);
    assert.deepEqual(await publicTests.json(), []);
    const questions = await m.QuestionModel.find({
      creator: "original-practice-import",
    });
    for (const q of questions) {
      questionSchema.parse(q.data);
      assert.equal(q.data.isPYQ, false);
      assert.match(q.data.source, /not an official/);
    }
    const q = questions[0];
    await m.QuestionModel.updateOne(
      { _id: q._id },
      {
        $set: {
          "data.explanation": "Teacher revised",
          status: "PUBLISHED",
          reviewer: "reviewed-fixture",
        },
      },
    );
    await call(tokens[2], { packId: "original-v1" });
    assert.equal(await m.QuestionModel.countDocuments(), 95);
    assert.equal(
      (await m.QuestionModel.findById(q._id)).data.explanation,
      "Teacher revised",
    );
    assert.equal((await m.QuestionModel.findById(q._id)).status, "PUBLISHED");
    const audit = await m.Audit.findOne({
      action: "PRACTICE_PACK_IMPORT",
      entityId: "original-v1",
    });
    assert.equal(audit.actor, String(users[2]._id));
  } finally {
    await new Promise((r) => (server ? server.close(r) : r()));
    await mongoose.disconnect();
    await db.stop();
  }
});

test("starter contains actual six-subject practice and a complete 100-mark reference mock", async () => {
  const { starterContent } = await import("../backend/src/starter-content.js");
  const packs = starterContent();
  assert.equal(packs.length, 7);
  assert.equal(
    packs.reduce((n, p) => n + p.questions.length, 0),
    198,
  );
  assert.deepEqual(
    new Set(packs.map((p) => p.subject)),
    new Set([
      "Mathematics",
      "Science",
      "Hindi",
      "English",
      "Sanskrit",
      "Social Science",
    ]),
  );
  const full = packs.find((p) => p.fullMock);
  assert.equal(full.questions.length, 138);
  assert.equal(
    full.sections.reduce(
      (n, s) => n + s.maxAnswers * full.questions[s.from].maximumMarks,
      0,
    ),
    100,
  );
  for (const p of packs)
    for (const q of p.questions) {
      questionSchema.parse({
        ...q,
        academic: {
          session: "2026-27",
          classLevel: "10",
          stream: "GENERAL",
          subjectId: "a".repeat(24),
        },
        language: "en",
        source: "Original fixture practice",
      });
      assert.ok(q.translation);
      if (q.type === "SINGLE_CHOICE") {
        assert.equal(q.correct.length, 1);
        assert.equal(new Set(q.options.map((o) => o.text)).size, 4);
      }
    }
  for (const [i, q] of full.questions.slice(0, 100).entries()) {
    const j = (i % 10) + 1,
      family = Math.floor(i / 10);
    const expected = [
      3 * j,
      2 * j + 2,
      j,
      4,
      j + 18,
      5 * j,
      44 * j,
      154 * j,
      j + 2,
      5 * j,
    ][family];
    assert.equal(
      Number(q.options.find((o) => o.id === q.correct[0]).text),
      expected,
    );
  }
});

test("reviewing a starter test publishes actual content into its series; stale/own-edited reviews are rejected", async () => {
  const db = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  let server;
  try {
    await m.connect(db.getUri());
    const { app } = await import("../backend/src/app.js");
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const users = await m.User.create(
      ["ADMIN", "STUDENT", "ADMIN"].map((role, i) => ({
        name: role,
        email: `starter-${i}@fixture.example`,
        role,
        classLevel: "10",
        stream: "GENERAL",
      })),
    );
    const tokens = users.map(accessToken),
      base = `http://127.0.0.1:${server.address().port}/api`;
    async function call(path, body, token = tokens[0]) {
      const r = await fetch(base + path, {
        method: body === undefined ? "GET" : "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: r.status, data: await r.json() };
    }
    const path = "/admin/practice-packs/class10-starter";
    assert.equal(
      (await call(path + "/review", undefined, tokens[1])).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/admin/practice-packs/import",
          { packId: "class10-starter" },
          tokens[1],
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call("/admin/practice-packs/import", {
          packId: "class10-starter",
        })
      ).data.questions,
      198,
    );
    let review = (await call(path + "/review")).data;
    assert.equal(review.tests.length, 7);
    assert.equal(review.questions.length, 198);
    const full = review.tests.find((t) => t.data.mode === "BOARD"),
      english = review.tests.find((t) =>
        t.data.title.startsWith("Grammar & vocabulary"),
      );
    assert.equal(
      (await call(`/tests/${english._id}/start`, {}, tokens[1])).status,
      404,
    );
    const input = {
      reviewToken: review.reviewToken,
      testId: english._id,
      confirmed: true,
    };
    assert.equal(
      (await call(path + "/publish", { ...input, confirmed: false })).status,
      400,
    );
    assert.equal((await call(path + "/publish", input)).status, 200);
    assert.equal((await call(path + "/publish", input)).status, 200);
    const started = await call(`/tests/${english._id}/start`, {}, tokens[1]);
    assert.equal(started.status, 201);
    assert.equal(started.data.questions.length, 10);
    assert.ok(!started.data.questions[0].correct);
    const series = (await call("/test-series", undefined, tokens[1])).data;
    assert.equal(series.find((s) => s.title === "English").testCount, 1);
    assert.equal(
      (await call(path + "/publish", { ...input, testId: full._id })).status,
      200,
    );
    const mock = await call(`/tests/${full._id}/start`, {}, tokens[1]);
    assert.equal(mock.status, 201);
    assert.equal(mock.data.questions.length, 138);
    assert.equal(mock.data.snapshot.sections[0].maxAnswers, 50);
    assert.equal(
      new Date(mock.data.deadline) - new Date(mock.data.startedAt),
      195 * 60000,
    );
    const science = review.tests.find((t) =>
        t.data.title.startsWith("Electricity"),
      ),
      q = review.questions.find((q) =>
        science.data.sections[0].questionIds.includes(q._id),
      );
    await m.QuestionModel.updateOne(
      { _id: q._id },
      {
        $set: {
          "data.text": "Teacher revision",
          creator: String(users[0]._id),
        },
        $inc: { version: 1 },
      },
    );
    assert.equal(
      (await call(path + "/publish", { ...input, testId: science._id })).status,
      409,
    );
    review = (await call(path + "/review")).data;
    assert.equal(
      (
        await call(path + "/publish", {
          reviewToken: review.reviewToken,
          testId: science._id,
          confirmed: true,
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call(
          path + "/publish",
          {
            reviewToken: review.reviewToken,
            testId: science._id,
            confirmed: true,
          },
          tokens[2],
        )
      ).status,
      200,
    );
    await call("/admin/practice-packs/import", { packId: "class10-starter" });
    assert.equal(await m.TestModel.countDocuments(), 7);
    assert.equal(await m.QuestionModel.countDocuments(), 198);
    assert.equal(
      (await m.QuestionModel.findById(q._id)).data.text,
      "Teacher revision",
    );
    assert.equal(
      await m.Audit.countDocuments({
        action: "STARTER_TEST_REVIEW_PUBLISH",
        entityId: english._id,
      }),
      1,
    );
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await db.stop();
  }
});
