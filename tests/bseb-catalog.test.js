import { test } from "node:test";
import assert from "node:assert/strict";
import { patternSchema } from "@boardtestify/domain";
import { catalogFor } from "../backend/src/bseb-catalog.js";
const academic = {
  session: "2026-27",
  classLevel: "10",
  stream: "GENERAL",
  subjectId: "a".repeat(24),
};
test("BSEB reference layouts preserve subject-specific marks, choices and reading time", () => {
  for (const [classLevel, stream] of [
    ["10", "GENERAL"],
    ["12", "SCIENCE"],
    ["12", "ARTS"],
    ["12", "COMMERCE"],
  ]) {
    for (const subject of catalogFor(classLevel, stream)) {
      if (!subject.sections.length) continue;
      patternSchema.parse({
        title: subject.name,
        academic: { ...academic, classLevel, stream },
        versionLabel: "2026 reference",
        officialSource: subject.sourceUrl,
        verifiedAt: "2026-10-28T00:00:00Z",
        durationMinutes: subject.durationMinutes,
        readingMinutes: subject.readingMinutes,
        totalMarks: subject.theoryMarks,
        sections: subject.sections,
      });
      assert.equal(subject.theoryMarks + subject.otherAssessmentMarks, 100);
    }
  }
  const ten = catalogFor("10", "GENERAL");
  const science = ten.find((s) => s.name === "Science");
  assert.equal(
    science.sections.reduce((n, s) => n + s.offered, 0),
    110,
  );
  assert.equal(
    science.sections.find((s) => s.id === "long-physics").marksEach,
    6,
  );
  assert.equal(
    science.sections.find((s) => s.id === "long-chemistry").marksEach,
    5,
  );
  assert.equal(science.durationMinutes, 165);
  assert.equal(science.writingMinutes, 150);
  assert.equal(ten.find((s) => s.name === "Mathematics").durationMinutes, 195);
  const social = ten.find((s) => s.name === "Social Science");
  assert.equal(social.sections.length, 10);
  assert.equal(
    social.sections.reduce((n, s) => n + s.offered, 0),
    112,
  );
  const commerce = catalogFor("12", "COMMERCE");
  assert.equal(
    commerce.find((s) => s.name === "Entrepreneurship").theoryMarks,
    70,
  );
  assert.equal(commerce.find((s) => s.name === "Accountancy").theoryMarks, 100);
  assert.equal(
    catalogFor("12", "SCIENCE").some((s) => s.name === "History"),
    false,
  );
});
