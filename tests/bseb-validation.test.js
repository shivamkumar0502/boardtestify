import test from "node:test";
import assert from "node:assert/strict";
import { validateBsebDraft } from "../backend/src/bseb-validation.js";

test("BSEB draft validation reports extracted types and catalog count mismatch", () => {
  const result = validateBsebDraft({
    source: { theoryMarks: 80, durationMinutes: 165, sections: [{ offered: 100 }, { offered: 20 }] },
    questions: [
      { data: { type: "SINGLE_CHOICE", correct: ["a"] } },
      { data: { type: "LONG_ANSWER", correct: [], referenceAnswer: "Answer", rubric: [{ id: "r1" }] } },
    ],
  });

  assert.equal(result.status, "REVIEW_REQUIRED");
  assert.equal(result.extractedQuestions, 2);
  assert.equal(result.extractedListedMarks, 0);
  assert.equal(result.expectedTheoryMarks, 80);
  assert.equal(result.expectedDurationMinutes, 165);
  assert.equal(result.expectedOfferedQuestions, 120);
  assert.equal(result.countDifference, -118);
  assert.deepEqual(result.questionTypes, { SINGLE_CHOICE: 1, LONG_ANSWER: 1 });
  assert.ok(result.warnings.some((warning) => warning.includes("omitted subparts")));
});

test("BSEB draft validation handles catalogs without section counts", () => {
  const result = validateBsebDraft({
    source: { sections: [] },
    questions: [{ data: { type: "SHORT_ANSWER", referenceAnswer: "", rubric: [] } }],
  });

  assert.equal(result.expectedOfferedQuestions, null);
  assert.equal(result.expectedTheoryMarks, null);
  assert.equal(result.countDifference, null);
  assert.equal(result.missingDescriptiveRubrics, 1);
  assert.ok(result.warnings.some((warning) => warning.includes("incomplete reference answers/rubrics")));
});

test("BSEB draft validation marks empty extraction as review required", () => {
  const result = validateBsebDraft({ source: { sections: [] }, questions: [] });
  assert.equal(result.extractedQuestions, 0);
  assert.ok(result.warnings.some((warning) => warning.includes("Do not publish")));
});
