import { test } from "node:test";
import assert from "node:assert/strict";
import {
  questionSchema,
  testSchema,
  scoreObjective,
  validateEvaluation,
  answerStatus,
  sanitizeExport,
  patternSchema,
} from "@boardtestify/domain";
const academic = {
  session: "2026-27",
  classLevel: "10",
  stream: "GENERAL",
  subjectId: "a".repeat(24),
};
export const q = questionSchema.parse({
  academic,
  type: "SINGLE_CHOICE",
  language: "en",
  text: "2 + 2?",
  options: [
    { id: "a", text: "4" },
    { id: "b", text: "5" },
  ],
  correct: ["a"],
  maximumMarks: 1,
  negativeMarks: 0.25,
  source: "Original illustrative test",
});
test("objective scoring handles correct, wrong, unanswered and rejects duplicate selections", () => {
  const question = { ...q, _id: "b".repeat(24), version: 1 };
  assert.equal(scoreObjective(question, ["a"]), 1);
  assert.equal(scoreObjective(question, ["b"]), -0.25);
  assert.equal(scoreObjective(question, []), 0);
  assert.equal(scoreObjective(question, ["a", "a"]), -0.25);
});
test("multiple choice requires the exact answer set and accepts any order", () => {
  const question = {
    ...q,
    type: "MULTIPLE_CHOICE",
    correct: ["a", "b"],
    _id: "b".repeat(24),
    version: 1,
  };
  assert.equal(scoreObjective(question, ["b", "a"]), 1);
  assert.equal(scoreObjective(question, ["a"]), -0.25);
});
test("numerical accepted alternatives", () => {
  const question = {
    ...q,
    type: "NUMERICAL",
    correct: ["0.5", "1/2"],
    _id: "b".repeat(24),
    version: 1,
  };
  assert.equal(scoreObjective(question, " 1/2 "), 1);
  assert.equal(scoreObjective(question, "0.6"), -0.25);
});
const descriptive = {
  ...q,
  _id: "b".repeat(24),
  version: 1,
  type: "LONG_ANSWER",
  maximumMarks: 5,
  rubric: [
    { id: "concept", name: "Concept", maximumMarks: 3 },
    { id: "steps", name: "Steps", maximumMarks: 2 },
  ],
};
const evaluation = {
  confidence: 0.9,
  detectedLanguage: "hi",
  criteria: [
    { id: "concept", awardedMarks: 2.5, feedback: "Concept stated" },
    { id: "steps", awardedMarks: 1.5, feedback: "One missing step" },
  ],
  strengths: [],
  missingPoints: [],
  errors: [],
  improvementAdvice: [],
  requiresManualReview: false,
  reviewReason: null,
};
test("evaluation computes total from rubric rather than trusting a model total", () => {
  assert.equal(validateEvaluation(descriptive, evaluation).awardedMarks, 4);
});
test("AI over-scoring, negative scoring, duplicate/missing criteria and invalid rounding are rejected", () => {
  for (const criteria of [
    [
      { id: "concept", awardedMarks: 5.5, feedback: "" },
      { id: "steps", awardedMarks: 1, feedback: "" },
    ],
    [
      { id: "concept", awardedMarks: -1, feedback: "" },
      { id: "steps", awardedMarks: 1, feedback: "" },
    ],
    [
      { id: "concept", awardedMarks: 1, feedback: "" },
      { id: "concept", awardedMarks: 1, feedback: "" },
    ],
    [{ id: "concept", awardedMarks: 1, feedback: "" }],
    [
      { id: "concept", awardedMarks: 1.2, feedback: "" },
      { id: "steps", awardedMarks: 1, feedback: "" },
    ],
  ])
    assert.throws(() =>
      validateEvaluation(descriptive, { ...evaluation, criteria }),
    );
});
test("invalid AI output never becomes zero marks", () => {
  for (const raw of [
    null,
    {},
    "broken",
    { awardedMarks: 0 },
    { ...evaluation, awardedMarks: 99 },
  ])
    assert.throws(() => validateEvaluation(descriptive, raw));
});
test("low confidence requires review", () => {
  assert.equal(
    validateEvaluation(descriptive, { ...evaluation, confidence: 0.6 }).status,
    "REVIEW",
  );
});
test("all five question statuses", () => {
  const answer = {
    questionId: "a".repeat(24),
    version: 0,
    value: [],
    visited: true,
    review: false,
  };
  assert.equal(answerStatus(), "NOT_VISITED");
  assert.equal(answerStatus(answer), "NOT_ANSWERED");
  assert.equal(answerStatus({ ...answer, value: ["a"] }), "ANSWERED");
  assert.equal(answerStatus({ ...answer, review: true }), "MARKED_FOR_REVIEW");
  assert.equal(
    answerStatus({ ...answer, review: true, value: ["a"] }),
    "ANSWERED_AND_MARKED_FOR_REVIEW",
  );
});
test("academic stream constraints and rubric sums validated", () => {
  assert.equal(
    questionSchema.safeParse({
      ...q,
      academic: { ...academic, stream: "SCIENCE" },
    }).success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({
      ...q,
      type: "SHORT_ANSWER",
      referenceAnswer: "Reference",
      rubric: [{ id: "x", name: "x", maximumMarks: 2 }],
    }).success,
    false,
  );
});
test("timed exams and internal choices cannot have invalid counts or duplicate IDs", () => {
  const t = {
    title: "Test",
    academic,
    mode: "CBT",
    durationMinutes: 20,
    sections: [{ id: "one", title: "One", questionIds: ["b".repeat(24)] }],
  };
  assert.equal(testSchema.safeParse(t).success, true);
  assert.equal(
    testSchema.safeParse({ ...t, durationMinutes: null }).success,
    false,
  );
  assert.equal(
    testSchema.safeParse({
      ...t,
      sections: [{ ...t.sections[0], maxAnswers: 2 }],
    }).success,
    false,
  );
  assert.equal(
    testSchema.safeParse({ ...t, sections: [t.sections[0], t.sections[0]] })
      .success,
    false,
  );
});
test("spreadsheet formula injection export defense", () => {
  for (const value of ["=1+1", " +cmd", "-2", "@formula", "\tdata", "\rdata"])
    assert.ok(sanitizeExport(value).startsWith("'"));
  assert.equal(sanitizeExport("Normal text"), "Normal text");
});


test("image-based MCQs require a validated image and score like single-choice questions", () => {
  const imageQuestion = questionSchema.parse({
    ...q,
    type: "IMAGE_BASED",
    imageKey: "question-images/example.jpeg",
    options: [{ id: "a", text: "Correct" }, { id: "b", text: "Incorrect" }],
    correct: ["a"],
  });
  assert.equal(scoreObjective(imageQuestion, ["a"]), imageQuestion.maximumMarks);
  assert.equal(scoreObjective(imageQuestion, ["b"]), -imageQuestion.negativeMarks);
  assert.equal(questionSchema.safeParse({ ...imageQuestion, imageKey: undefined }).success, false);
  assert.equal(questionSchema.safeParse({ ...imageQuestion, correct: ["a", "b"] }).success, false);
});


test("pattern minimum passing marks are optional and bounded by total marks", () => {
  const pattern = {
    title: "Example pattern",
    academic,
    versionLabel: "1",
    officialSource: "https://example.org/pattern.pdf",
    verifiedAt: new Date().toISOString(),
    durationMinutes: 60,
    totalMarks: 10,
    sections: [{ id: "one", title: "Section one", offered: 10, answerCount: 10, marksEach: 1, types: ["SINGLE_CHOICE"] }],
  };
  assert.equal(patternSchema.safeParse(pattern).success, true);
  assert.equal(patternSchema.safeParse({ ...pattern, minimumPassingMarks: 5 }).success, true);
  assert.equal(patternSchema.safeParse({ ...pattern, minimumPassingMarks: 11 }).success, false);
  assert.equal(patternSchema.safeParse({ ...pattern, minimumPassingMarks: -1 }).success, false);
});
