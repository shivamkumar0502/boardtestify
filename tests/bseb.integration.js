import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/pending";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "bseb-seed-fixture-secret-".repeat(3);
const { connect, QuestionModel, TestModel } =
  await import("../backend/src/models.js");
const { seedBSEB, packs } = await import("../backend/src/seed-bseb.js");
const { scoreObjective, questionSchema, testSchema } =
  await import("@boardtestify/domain");
test("BSEB mini-pack seeds five source-linked draft tests, respects review edits, and never duplicates or publishes", async () => {
  const db = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  try {
    await connect(db.getUri());
    assert.deepEqual(await seedBSEB(), {
      tests: 5,
      questions: 15,
      status: "DRAFT",
    });
    const tests = await TestModel.find({ creator: "bseb-mini-import" }).lean();
    assert.equal(tests.length, 5);
    assert.equal(new Set(tests.map((t) => t.data.academic.stream)).size, 4);
    for (const t of tests) {
      testSchema.parse(t.data);
      assert.equal(t.status, "DRAFT");
      assert.equal(t.data.academic.session, "2025-26");
      assert.equal(t.data.sections[0].questionIds.length, 3);
      assert.equal(
        new URL(t.data.officialSource).hostname,
        "biharboardonline.com",
      );
      const qs = await QuestionModel.find({
        _id: { $in: t.data.sections[0].questionIds },
      }).lean();
      for (const q of qs) {
        questionSchema.parse(q.data);
        assert.equal(q.status, "DRAFT");
        assert.equal(q.data.isPYQ, false);
        assert.equal(q.data.sourceYear, 2026);
        assert.ok(q.data.sourceUrl.includes("#page="));
        assert.ok(q.data.translation.length);
        assert.match(q.data.source, /not an official answer key/);
        assert.equal(scoreObjective(q.data, q.data.correct), 1);
      }
    }
    // Teacher edits/publication survive retries, even if the test title is changed.
    const first = tests[0];
    await TestModel.updateOne(
      { _id: first._id },
      {
        $set: {
          "data.title": "Teacher revised title",
          status: "PUBLISHED",
          reviewer: "fixture-teacher",
        },
      },
    );
    await seedBSEB();
    assert.equal(
      await TestModel.countDocuments({ creator: "bseb-mini-import" }),
      5,
    );
    assert.equal(
      await QuestionModel.countDocuments({ creator: "bseb-mini-import" }),
      15,
    );
    assert.equal(
      (await TestModel.findById(first._id)).data.title,
      "Teacher revised title",
    );
    assert.equal((await TestModel.findById(first._id)).status, "PUBLISHED");
    // Independently calculated numeric keys, rather than a copied board key.
    const math = packs.find((p) => p.subject === "Mathematics").questions[1];
    assert.equal(Number(math.options[math.answer]), 4 + 2 - 1);
    assert.equal(
      Number(
        packs
          .find((p) => p.subject === "Physics")
          .questions[2].options[2].split(" ")[0],
      ),
      (1200 * 4) / 6,
    );
  } finally {
    await mongoose.disconnect();
    await db.stop();
  }
});
