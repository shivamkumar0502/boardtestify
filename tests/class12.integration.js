import { test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/pending";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "class12-only-fixture-secret-".repeat(3);
test("Class 12 packs import/review/publish independently and students start only their stream's tests", async () => {
  const db = await MongoMemoryServer.create({
    instance: { args: ["--nounixsocket"] },
  });
  let server;
  try {
    const m = await import("../backend/src/models.js");
    await m.connect(db.getUri());
    const { app } = await import("../backend/src/app.js"),
      { accessToken } = await import("../backend/src/lib.js");
    server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const users = await m.User.create(
      [
        ["ADMIN", "GENERAL", "10"],
        ["STUDENT", "SCIENCE", "12"],
        ["STUDENT", "ARTS", "12"],
        ["STUDENT", "COMMERCE", "12"],
        ["STUDENT", "GENERAL", "10"],
      ].map(([role, stream, classLevel], i) => ({
        name: role,
        email: `twelve-${i}@fixture.example`,
        role,
        stream,
        classLevel,
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
    const reviews = {};
    for (const stream of ["science", "arts", "commerce"]) {
      const id = `class12-${stream}-starter`,
        path = `/admin/practice-packs/${id}`;
      assert.equal(
        (await call("/admin/practice-packs/import", { packId: id }, tokens[1]))
          .status,
        403,
      );
      const imported = await call("/admin/practice-packs/import", {
        packId: id,
      });
      assert.equal(imported.status, 200);
      assert.equal(imported.data.questions, stream === "science" ? 156 : 60);
      const review = await call(path + "/review");
      assert.equal(review.status, 200);
      reviews[stream] = review.data;
      assert.ok(
        review.data.tests.every(
          (t) =>
            t.data.academic.classLevel === "12" &&
            t.data.academic.stream === stream.toUpperCase() &&
            t.status === "DRAFT",
        ),
      );
    }
    assert.equal(await m.TestModel.countDocuments(), 19);
    assert.equal(await m.QuestionModel.countDocuments(), 276);
    const science = reviews.science,
      full = science.tests.find((t) => t.data.mode === "BOARD"),
      chem = science.tests.find((t) => t.data.title.startsWith("Solutions"));
    async function publish(stream, t) {
      return call(`/admin/practice-packs/class12-${stream}-starter/publish`, {
        reviewToken: reviews[stream].reviewToken,
        testId: t._id,
        confirmed: true,
      });
    }
    assert.equal((await publish("science", full)).status, 200);
    assert.equal((await publish("science", chem)).status, 200);
    assert.equal(
      (
        await publish(
          "arts",
          reviews.arts.tests.find((t) =>
            t.data.title.startsWith("Indian national"),
          ),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await publish(
          "commerce",
          reviews.commerce.tests.find((t) =>
            t.data.title.startsWith("Partnership"),
          ),
        )
      ).status,
      200,
    );
    assert.equal((await publish("science", reviews.arts.tests[0])).status, 400);
    const start = await call(`/tests/${full._id}/start`, {}, tokens[1]);
    assert.equal(start.status, 201);
    assert.equal(start.data.questions.length, 96);
    assert.deepEqual(
      start.data.snapshot.sections.map((s) => s.maxAnswers),
      [35, 10, 3],
    );
    assert.equal(
      new Date(start.data.deadline) - new Date(start.data.startedAt),
      195 * 60000,
    );
    assert.equal(
      (await call(`/tests/${full._id}/start`, {}, tokens[2])).status,
      403,
    );
    assert.equal(
      (await call(`/tests/${full._id}/start`, {}, tokens[4])).status,
      403,
    );
    const group = (await call("/test-series", undefined, tokens[1])).data.find(
      (g) => g.title === "Physics",
    );
    assert.equal(group.testCount, 1);
    const rows = (
      await call(
        `/test-series/${group.id}/tests?kind=FULL_MOCK`,
        undefined,
        tokens[1],
      )
    ).data;
    assert.equal(rows.rows.length, 1);
    assert.equal(rows.paper.theoryMarks, 70);
    assert.ok(!JSON.stringify(rows).includes("referenceAnswer"));
    const arts = (await call("/test-series", undefined, tokens[2])).data;
    assert.equal(
      arts.some((g) => g.title === "Physics"),
      false,
    );
    for (const stream of ["science", "arts", "commerce"])
      await call("/admin/practice-packs/import", {
        packId: `class12-${stream}-starter`,
      });
    assert.equal(await m.TestModel.countDocuments(), 19);
    assert.equal(await m.QuestionModel.countDocuments(), 276);
    assert.equal(await m.TestModel.countDocuments({ status: "PUBLISHED" }), 4);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await mongoose.disconnect();
    await db.stop();
  }
});
