import { test } from "node:test";
import assert from "node:assert/strict";
import {
  answerPresent,
  answerStatus,
  patternSchema,
  validateEvaluation,
} from "@boardtestify/domain";
import { setLanguage, tr } from "@boardtestify/i18n";
import hindi from "../packages/i18n/src/hi.js";
test("Hindi interface translates labels, preserves spaces, and interpolates values in both languages", () => {
  setLanguage("hi");
  assert.equal(tr("Save profile"), "प्रोफाइल सुरक्षित करें");
  assert.equal(tr("Class "), "कक्षा ");
  assert.equal(tr("Active until {0}", ["27/10/2026"]), "27/10/2026 तक सक्रिय");
  assert.equal(tr("PUBLISHED"), "प्रकाशित");
  setLanguage("en");
  assert.equal(tr("{0} minutes", [15]), "15 minutes");
  assert.equal(tr("Save profile"), "Save profile");
  const object = { name: "Science" };
  assert.equal(tr(object), object);
});
test("Hindi translations retain template variables", () => {
  for (const [key, value] of Object.entries(hindi))
    assert.deepEqual(
      [...key.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort(),
      [...value.matchAll(/\{\d+\}/g)].map((m) => m[0]).sort(),
      key,
    );
});
test("an uploaded answer page is an answered question even without typed text", () => {
  const a = {
    value: "",
    attachmentIds: ["a".repeat(24)],
    visited: true,
    review: false,
  };
  assert.equal(answerPresent(a), true);
  assert.equal(answerStatus(a), "ANSWERED");
  assert.equal(
    answerStatus({ ...a, review: true }),
    "ANSWERED_AND_MARKED_FOR_REVIEW",
  );
});
test("quarter-mark policies are validated arithmetically", () => {
  const q = {
    maximumMarks: 1,
    scoringStep: 0.25,
    language: "hi",
    rubric: [{ id: "method", maximumMarks: 1 }],
  };
  const raw = {
    confidence: 0.95,
    detectedLanguage: "hi",
    criteria: [{ id: "method", awardedMarks: 0.75, feedback: "सही तरीका" }],
    strengths: [],
    missingPoints: [],
    errors: [],
    improvementAdvice: [],
    requiresManualReview: false,
    reviewReason: null,
  };
  assert.equal(validateEvaluation(q, raw).awardedMarks, 0.75);
  assert.throws(() => validateEvaluation({ ...q, scoringStep: 0.5 }, raw));
});
test("official pattern totals and choices must be internally consistent", () => {
  const p = {
    title: "Verified reference",
    academic: {
      session: "2025-26",
      classLevel: "12",
      stream: "SCIENCE",
      subjectId: "a".repeat(24),
    },
    versionLabel: "2026",
    officialSource:
      "https://biharboardonline.com/files/InterModelPaper/2026/117_Physics.pdf",
    verifiedAt: "2026-10-26T00:00:00.000Z",
    durationMinutes: 195,
    totalMarks: 70,
    sections: [
      {
        id: "a",
        title: "Objective",
        offered: 70,
        answerCount: 35,
        marksEach: 1,
        types: ["SINGLE_CHOICE"],
      },
      {
        id: "b",
        title: "Short",
        offered: 20,
        answerCount: 10,
        marksEach: 2,
        types: ["SHORT_ANSWER"],
      },
      {
        id: "c",
        title: "Long",
        offered: 6,
        answerCount: 3,
        marksEach: 5,
        types: ["LONG_ANSWER"],
      },
    ],
  };
  assert.equal(patternSchema.safeParse(p).success, true);
  assert.equal(
    patternSchema.safeParse({ ...p, totalMarks: 100 }).success,
    false,
  );
});
