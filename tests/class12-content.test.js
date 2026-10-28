import { test } from "node:test";
import assert from "node:assert/strict";
import { questionSchema } from "@boardtestify/domain";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/content";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "content-only-fixture-secret-".repeat(3);
const { class12Content } = await import("../backend/src/class12-content.js");
test("Class 12 stream packs contain 19 actual tests and 276 valid bilingual questions", () => {
  let tests = 0,
    questions = 0;
  for (const stream of ["SCIENCE", "ARTS", "COMMERCE"]) {
    const packs = class12Content(stream);
    tests += packs.length;
    assert.equal(
      new Set(packs.filter((p) => !p.fullMock).map((p) => p.subject)).size,
      6,
    );
    for (const p of packs)
      for (const q of p.questions) {
        questions++;
        questionSchema.parse({
          ...q,
          academic: {
            session: "2026-27",
            classLevel: "12",
            stream,
            subjectId: "a".repeat(24),
          },
          language: "en",
          source: "Original practice",
        });
        assert.ok(q.translation);
        if (q.type === "SINGLE_CHOICE")
          assert.equal(new Set(q.options.map((o) => o.text)).size, 4);
      }
  }
  assert.equal(tests, 19);
  assert.equal(questions, 276);
  assert.equal(
    class12Content("ARTS").some((p) => p.subject === "Physics"),
    false,
  );
});
test("Physics mock keys, answer limits and 70 theory marks are arithmetically consistent", () => {
  const full = class12Content("SCIENCE").find((p) => p.fullMock);
  assert.equal(full.questions.length, 96);
  assert.deepEqual(
    full.sections.map((s) => s.maxAnswers),
    [35, 10, 3],
  );
  assert.equal(
    full.sections.reduce(
      (n, s) => n + s.maxAnswers * full.questions[s.from].maximumMarks,
      0,
    ),
    70,
  );
  for (const [i, q] of full.questions.slice(0, 70).entries()) {
    const j = (i % 10) + 1;
    const family = Math.floor(i / 10);
    const expected = [
      2 * j + 7,
      2 * j,
      j * 1000,
      j + 3,
      12 * j,
      10 * j,
      1024 / 2 ** j,
    ][family];
    assert.equal(
      Number(q.options.find((o) => o.id === q.correct[0]).text),
      expected,
    );
  }
  const math = class12Content("SCIENCE").find(
    (p) => p.subject === "Mathematics",
  );
  for (const [i, q] of math.questions.entries())
    assert.equal(
      Number(q.options.find((o) => o.id === q.correct[0]).text),
      3 * (i + 1) + 4,
    );
});
