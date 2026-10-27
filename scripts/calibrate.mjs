import fs from "node:fs/promises";
import { questionSchema } from "@boardtestify/domain";
import { evaluate } from "../backend/src/evaluation.js";
const file = process.argv[2];
if (!file)
  throw Error(
    "Pass a teacher-labelled JSON case file. See docs/CLIENT_HANDOFF.md.",
  );
const source = await fs.readFile(file, "utf8");
if (Buffer.byteLength(source) > 2_000_000)
  throw Error("Calibration file exceeds 2 MB");
const cases = JSON.parse(source);
if (!Array.isArray(cases) || !cases.length || cases.length > 200)
  throw Error("Provide between 1 and 200 cases");
const rows = [];
for (let i = 0; i < cases.length; i++) {
  const c = cases[i],
    q = questionSchema.parse(c.question);
  if (
    !["SHORT_ANSWER", "LONG_ANSWER"].includes(q.type) ||
    typeof c.answer !== "string" ||
    c.answer.length > 20000 ||
    !Number.isFinite(c.expectedMarks) ||
    c.expectedMarks < 0 ||
    c.expectedMarks > q.maximumMarks
  )
    throw Error(`Invalid teacher case ${i + 1}`);
  const result = await evaluate(q, c.answer);
  rows.push({
    id: c.id || i + 1,
    subjectId: q.academic.subjectId,
    language: q.language,
    expectedMarks: c.expectedMarks,
    suggestedMarks: result.awardedMarks,
    requiresReview: result.requiresManualReview,
    error:
      result.awardedMarks === null
        ? null
        : Math.abs(c.expectedMarks - result.awardedMarks),
  });
}
const valid = rows.filter((r) => r.error !== null);
const mae = valid.length
  ? valid.reduce((n, r) => n + r.error, 0) / valid.length
  : null;
const report = {
  caseCount: rows.length,
  scored: valid.length,
  meanAbsoluteError: mae,
  manualReviewRate: rows.filter((r) => r.requiresReview).length / rows.length,
  teacherDatasetSufficientForInitialReview:
    rows.length >= 40 && new Set(rows.map((r) => r.language)).size >= 2,
  automaticReleaseApproved: false,
  note: "A diagnostic report, not teacher approval or an official BSEB marking certificate. Handwritten answers still require human review.",
  rows,
};
console.log(JSON.stringify(report, null, 2));
if (valid.length !== rows.length || mae > 0.5) process.exitCode = 1;
