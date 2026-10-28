import { z } from "zod";
export const roles = [
  "STUDENT",
  "CONTENT_EDITOR",
  "EVALUATOR",
  "ADMIN",
  "SUPER_ADMIN",
];
export const id = z.string().regex(/^[a-f\d]{24}$/i, "Invalid ID");
const text = z.string().trim().min(1).max(20000);
export const academicSchema = z
  .object({
    session: z.string().regex(/^\d{4}-\d{2}$/),
    classLevel: z.enum(["10", "12"]),
    stream: z.enum(["GENERAL", "ARTS", "SCIENCE", "COMMERCE"]),
    subjectId: id,
    chapterId: id.optional(),
    topic: z.string().max(200).optional(),
  })
  .superRefine((v, c) => {
    if ((v.classLevel === "10") !== (v.stream === "GENERAL"))
      c.addIssue({
        code: "custom",
        message: "Class 10 uses GENERAL; Class 12 needs a stream",
      });
  });
export const rubricSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(50),
      name: text,
      maximumMarks: z.number().positive().max(100),
    }),
  )
  .max(30);
export const questionSchema = z
  .object({
    academic: academicSchema,
    type: z.enum([
      "SINGLE_CHOICE",
      "MULTIPLE_CHOICE",
      "SHORT_ANSWER",
      "LONG_ANSWER",
      "NUMERICAL",
    ]),
    language: z.enum(["hi", "en"]),
    text,
    translation: z.string().max(20000).optional(),
    imageKey: z.string().max(300).optional(),
    options: z
      .array(z.object({ id: z.string().min(1).max(10), text }))
      .max(8)
      .default([]),
    correct: z.array(z.string().max(200)).default([]),
    referenceAnswer: z.string().max(20000).default(""),
    alternatives: z.array(z.string().max(5000)).max(20).default([]),
    explanation: z.string().max(10000).default(""),
    rubric: rubricSchema.default([]),
    maximumMarks: z.number().positive().max(100),
    negativeMarks: z.number().min(0).max(100).default(0),
    difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).default("MEDIUM"),
    source: text,
    sourceUrl: z
      .string()
      .url()
      .max(1000)
      .refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS source URL")
      .optional(),
    sourceYear: z.number().int().min(1900).max(2200).optional(),
    isPYQ: z.boolean().default(false),
    scoringStep: z
      .union([z.literal(1), z.literal(0.5), z.literal(0.25)])
      .default(0.5),
    requiresDiagram: z.boolean().default(false),
  })
  .superRefine((q, c) => {
    const issue = (message) => c.addIssue({ code: "custom", message });
    if (q.negativeMarks > q.maximumMarks)
      issue("Negative marks exceed maximum");
    if (new Set(q.options.map((o) => o.id)).size !== q.options.length)
      issue("Option IDs must be unique");
    if (q.type.endsWith("CHOICE")) {
      if (
        q.options.length < 2 ||
        !q.correct.length ||
        q.correct.some((x) => !q.options.some((o) => o.id === x))
      )
        issue("Valid options and answer key required");
      if (q.type === "SINGLE_CHOICE" && q.correct.length !== 1)
        issue("Single choice needs one answer");
    }
    if (q.type === "NUMERICAL" && !q.correct.length)
      issue("Accepted numerical answers required");
    if (isDescriptive(q.type)) {
      if (!q.referenceAnswer || !q.rubric.length)
        issue("Reference and rubric required");
      if (
        Math.abs(
          q.rubric.reduce((s, r) => s + r.maximumMarks, 0) - q.maximumMarks,
        ) > 0.001
      )
        issue("Rubric must sum to maximum marks");
    }
    if (new Set(q.rubric.map((r) => r.id)).size !== q.rubric.length)
      issue("Rubric IDs must be unique");
    if (q.isPYQ && !q.sourceUrl) issue("PYQs need a source URL and approval");
    if (new Set(q.correct).size !== q.correct.length)
      issue("Correct answer IDs must be unique");
    if (
      isDescriptive(q.type) &&
      q.rubric.some(
        (r) =>
          Math.abs(
            r.maximumMarks / q.scoringStep -
              Math.round(r.maximumMarks / q.scoringStep),
          ) > 0.0001,
      )
    )
      issue("Rubric maximum must follow the scoring step");
  });
export function isDescriptive(type) {
  return type === "SHORT_ANSWER" || type === "LONG_ANSWER";
}
export const testSchema = z
  .object({
    title: text,
    description: z.string().max(2000).default(""),
    academic: academicSchema,
    mode: z.enum(["PRACTICE", "CBT", "BOARD"]),
    durationMinutes: z.number().int().min(1).max(360).nullable(),
    readingMinutes: z.number().int().min(0).max(30).default(0),
    premium: z.boolean().default(false),
    randomize: z.boolean().default(false),
    patternVersion: z.string().max(100).default("1"),
    officialSource: z
      .string()
      .url()
      .refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS source URL")
      .optional(),
    verifiedAt: z.string().datetime().optional(),
    patternId: id.optional(),
    feedbackMode: z
      .enum(["AFTER_SUBMISSION", "IMMEDIATE"])
      .default("AFTER_SUBMISSION"),
    sections: z
      .array(
        z.object({
          id: z.string().min(1).max(50),
          title: text,
          instructions: z.string().max(3000).default(""),
          questionIds: z.array(id).min(1).max(200),
          drawCount: z.number().int().positive().max(200).optional(),
          maxAnswers: z.number().int().positive().max(200).optional(),
          wordLimit: z.number().int().positive().max(5000).optional(),
          allowedTypes: z
            .array(
              z.enum([
                "SINGLE_CHOICE",
                "MULTIPLE_CHOICE",
                "SHORT_ANSWER",
                "LONG_ANSWER",
                "NUMERICAL",
              ]),
            )
            .min(1)
            .optional(),
          choicePolicy: z
            .enum(["LIMIT_ANSWERS", "FIRST_IN_PAPER"])
            .default("LIMIT_ANSWERS"),
        }),
      )
      .min(1)
      .max(10),
  })
  .superRefine((t, c) => {
    if (
      t.readingMinutes &&
      (!t.durationMinutes || t.readingMinutes >= t.durationMinutes)
    )
      c.addIssue({
        code: "custom",
        message: "Reading time must be shorter than the total test duration",
      });
    if (t.mode !== "PRACTICE" && t.durationMinutes === null)
      c.addIssue({ code: "custom", message: "Timed exams require duration" });
    if (t.mode !== "PRACTICE" && t.feedbackMode === "IMMEDIATE")
      c.addIssue({
        code: "custom",
        message: "Immediate feedback is only allowed in practice mode",
      });
    if (new Set(t.sections.map((s) => s.id)).size !== t.sections.length)
      c.addIssue({ code: "custom", message: "Section IDs must be unique" });
    for (const s of t.sections) {
      const n = s.drawCount ?? s.questionIds.length;
      if (n > s.questionIds.length || (s.maxAnswers ?? n) > n)
        c.addIssue({ code: "custom", message: "Invalid section counts" });
    }
    const ids = t.sections.flatMap((s) => s.questionIds);
    if (ids.length > 200)
      c.addIssue({
        code: "custom",
        message: "A test may contain at most 200 questions",
      });
    if (new Set(ids).size !== ids.length)
      c.addIssue({
        code: "custom",
        message: "Questions cannot repeat across sections",
      });
  });
export const answerSchema = z.object({
  questionId: id,
  version: z.number().int().min(0),
  value: z.union([z.string().max(20000), z.array(z.string().max(200)).max(8)]),
  visited: z.boolean().default(true),
  review: z.boolean().default(false),
  attachmentIds: z.array(id).max(4).default([]),
});
export function answerPresent(a) {
  return hasAnswer(a?.value) || !!a?.attachmentIds?.length;
}
export function hasAnswer(value) {
  return Array.isArray(value) ? value.length > 0 : !!value?.trim();
}
export function answerStatus(a) {
  if (!a?.visited) return "NOT_VISITED";
  if (a.review)
    return answerPresent(a)
      ? "ANSWERED_AND_MARKED_FOR_REVIEW"
      : "MARKED_FOR_REVIEW";
  return answerPresent(a) ? "ANSWERED" : "NOT_ANSWERED";
}
export function scoreObjective(q, value) {
  if (!hasAnswer(value)) return 0;
  const actual = (Array.isArray(value) ? value : [value])
    .map((x) => String(x).trim())
    .sort();
  const correct = q.correct.map((x) => x.trim()).sort();
  const ok =
    q.type === "NUMERICAL"
      ? actual.length === 1 && correct.includes(actual[0])
      : actual.length === correct.length &&
        actual.every((x, i) => x === correct[i]);
  return ok ? q.maximumMarks : -q.negativeMarks;
}
export const evaluationSchema = z
  .object({
    confidence: z.number().min(0).max(1),
    detectedLanguage: z.enum(["hi", "en", "mixed", "other"]),
    criteria: z.array(
      z.object({
        id: z.string(),
        awardedMarks: z.number().min(0),
        feedback: z.string().max(2000),
      }),
    ),
    strengths: z.array(z.string().max(1000)).max(20),
    missingPoints: z.array(z.string().max(1000)).max(20),
    errors: z.array(z.string().max(1000)).max(20),
    improvementAdvice: z.array(z.string().max(1000)).max(20),
    requiresManualReview: z.boolean(),
    reviewReason: z.string().max(1000).nullable(),
  })
  .strict();
export function validateEvaluation(q, raw) {
  const e = evaluationSchema.parse(raw);
  if (new TextEncoder().encode(JSON.stringify(e)).length > 12000)
    throw Error("Evaluation feedback is too large");
  if (
    e.criteria.length !== q.rubric.length ||
    new Set(e.criteria.map((c) => c.id)).size !== q.rubric.length
  )
    throw Error("Incomplete rubric");
  let total = 0;
  for (const c of e.criteria) {
    const r = q.rubric.find((r) => r.id === c.id);
    if (
      !r ||
      c.awardedMarks > r.maximumMarks ||
      Math.abs(
        c.awardedMarks / (q.scoringStep || 0.5) -
          Math.round(c.awardedMarks / (q.scoringStep || 0.5)),
      ) > 0.001
    )
      throw Error("Invalid criterion marks or half-mark rounding");
    total += c.awardedMarks;
  }
  if (total > q.maximumMarks) throw Error("Invalid total");
  return {
    ...e,
    awardedMarks: total,
    maximumMarks: q.maximumMarks,
    evaluationLanguage: q.language,
    requiresManualReview: e.requiresManualReview || e.confidence < 0.8,
    status:
      e.requiresManualReview || e.confidence < 0.8 ? "REVIEW" : "EVALUATED",
  };
}
export const planSchema = z.object({
  name: z.string().trim().min(2).max(100),
  description: z.string().max(1000).default(""),
  pricePaise: z.number().int().min(100).max(10000000),
  durationDays: z.number().int().min(1).max(730),
  billingModel: z.enum(["ONE_TIME", "RECURRING"]),
  providerPlanId: z
    .string()
    .regex(/^plan_[a-zA-Z0-9]+$/)
    .optional(),
  period: z.enum(["daily", "weekly", "monthly", "yearly"]).default("monthly"),
  interval: z.number().int().min(1).max(12).default(1),
  totalCount: z.number().int().min(1).max(120).default(12),
  classLevels: z.array(z.enum(["10", "12"])).min(1),
  streams: z.array(z.enum(["GENERAL", "SCIENCE", "ARTS", "COMMERCE"])).min(1),
  active: z.boolean().default(true),
});
export const patternSchema = z
  .object({
    title: z.string().min(2).max(200),
    academic: academicSchema,
    versionLabel: z.string().min(1).max(100),
    officialSource: z
      .string()
      .url()
      .refine(
        (v) => /^https?:\/\//i.test(v),
        "Use an HTTP or HTTPS source URL",
      ),
    verifiedAt: z.string().datetime(),
    durationMinutes: z.number().int().min(1).max(360),
    readingMinutes: z.number().int().min(0).max(30).default(0),
    totalMarks: z.number().positive().max(1000),
    sections: z
      .array(
        z.object({
          id: z.string().min(1).max(50),
          title: z.string().min(1).max(200),
          instructions: z.string().max(3000).default(""),
          offered: z.number().int().min(1).max(200),
          answerCount: z.number().int().min(1).max(200),
          marksEach: z.number().positive().max(100),
          negativeMarks: z.number().min(0).max(100).default(0),
          types: z
            .array(
              z.enum([
                "SINGLE_CHOICE",
                "MULTIPLE_CHOICE",
                "SHORT_ANSWER",
                "LONG_ANSWER",
                "NUMERICAL",
              ]),
            )
            .min(1),
          wordLimit: z.number().int().min(1).max(5000).optional(),
        }),
      )
      .min(1)
      .max(10),
  })
  .superRefine((p, c) => {
    if (
      p.sections.some((s) => s.answerCount > s.offered) ||
      p.sections.reduce((n, s) => n + s.offered, 0) > 200
    )
      c.addIssue({
        code: "custom",
        message: "Invalid pattern question counts",
      });
    if (new Set(p.sections.map((s) => s.id)).size !== p.sections.length)
      c.addIssue({ code: "custom", message: "Duplicate section ID" });
    if (
      Math.abs(
        p.sections.reduce((n, s) => n + s.answerCount * s.marksEach, 0) -
          p.totalMarks,
      ) > 0.001
    )
      c.addIssue({
        code: "custom",
        message: "Pattern section marks must equal total marks",
      });
  });
export function sanitizeExport(value) {
  const s = String(value ?? "");
  return /^[\s]*[=+\-@\t\r]/.test(s) ? `'${s}` : s;
}
