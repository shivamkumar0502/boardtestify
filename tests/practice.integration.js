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
    assert.equal((await call(tokens[2])).data.length, 2);
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
