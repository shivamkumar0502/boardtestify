import { Router } from "express";
import { randomInt } from "node:crypto";
import { z } from "zod";
import {
  answerSchema,
  id,
  hasAnswer,
  isDescriptive,
  scoreObjective,
} from "@boardtestify/domain";
import { Attempt, TestModel, QuestionModel, Payment, Audit } from "./models.js";
import { auth, allow, assert, HttpError } from "./lib.js";
import { evaluate } from "./evaluation.js";
import { env } from "./config.js";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
export const attempts = Router();
attempts.use(auth);
export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function publicAttempt(a) {
  return {
    id: String(a._id),
    testId: a.testId,
    snapshot: a.snapshot,
    status: a.status,
    startedAt: a.startedAt,
    deadline: a.deadline,
    serverNow: new Date().toISOString(),
    revision: a.revision,
    answers: a.answers,
    questions: a.questions.map((q) => {
      const {
        correct,
        referenceAnswer,
        alternatives,
        explanation,
        rubric,
        source,
        sourceUrl,
        sourceYear,
        ...safe
      } = q;
      return safe;
    }),
  };
}
export async function finalize(a, now = new Date()) {
  if (a.status !== "ACTIVE") return a;
  const expired = !!a.deadline && a.deadline <= now;
  const evaluations = {};
  for (const q of a.questions) {
    const answer = a.answers[q._id]?.value;
    if (isDescriptive(q.type)) {
      evaluations[q._id] = hasAnswer(answer)
        ? {
            status: "PENDING",
            awardedMarks: null,
            maximumMarks: q.maximumMarks,
          }
        : {
            status: "EVALUATED",
            awardedMarks: 0,
            maximumMarks: q.maximumMarks,
            feedback: "Unanswered",
          };
    } else
      evaluations[q._id] = {
        status: "EVALUATED",
        awardedMarks: scoreObjective(q, answer),
        maximumMarks: q.maximumMarks,
      };
  }
  const updated = await Attempt.findOneAndUpdate(
    { _id: a._id, status: "ACTIVE", revision: a.revision },
    {
      $set: {
        status: expired ? "EXPIRED" : "SUBMITTED",
        submittedAt: now,
        evaluations,
        evaluationState: Object.values(evaluations).some(
          (e) => e.status === "PENDING",
        )
          ? "PENDING"
          : "COMPLETE",
      },
      $inc: { revision: 1 },
    },
    { returnDocument: "after" },
  );
  if (!updated)
    throw new HttpError(409, "Attempt changed; reload before submitting");
  return updated;
}
async function owned(attemptId, userId) {
  const a = await Attempt.findOne({ _id: id.parse(attemptId), userId });
  assert(a, 404, "Attempt not found");
  if (a.status === "ACTIVE" && a.deadline && a.deadline <= new Date())
    return finalize(a);
  return a;
}
attempts.post("/tests/:id/start", async (req, res) => {
  const testId = id.parse(req.params.id),
    userId = String(req.user._id);
  const current = await Attempt.findOne({ testId, userId, status: "ACTIVE" });
  if (current) {
    const a = await owned(String(current._id), userId);
    if (a.status === "ACTIVE") return res.json(publicAttempt(a));
  }
  const t = await TestModel.findOne({ _id: testId, status: "PUBLISHED" });
  assert(t, 404, "Published test not found");
  const d = t.data;
  assert(
    req.user.classLevel === d.academic.classLevel &&
      req.user.stream === d.academic.stream,
    403,
    "Test does not match your class/stream",
  );
  if (d.premium)
    assert(
      await Payment.exists({
        userId,
        status: "PAID",
        expiresAt: { $gt: new Date() },
      }),
      402,
      "A valid study pass is required",
    );
  const questions = [];
  for (const section of d.sections) {
    const ids = d.randomize
      ? shuffle(section.questionIds).slice(
          0,
          section.drawCount ?? section.questionIds.length,
        )
      : section.questionIds.slice(
          0,
          section.drawCount ?? section.questionIds.length,
        );
    const rows = await QuestionModel.find({
      _id: { $in: ids },
      status: "PUBLISHED",
    }).lean();
    assert(rows.length === ids.length, 409, "Test content is unavailable");
    for (const qid of ids) {
      const q = rows.find((q) => String(q._id) === qid);
      questions.push({
        ...q.data,
        _id: String(q._id),
        version: q.version,
        sectionId: section.id,
        wordLimit: section.wordLimit,
      });
    }
  }
  const now = new Date();
  const snapshot = {
    ...d,
    sections: d.sections.map((s) => ({
      ...s,
      questionIds: questions
        .filter((q) => q.sectionId === s.id)
        .map((q) => q._id),
    })),
  };
  try {
    assert(
      Buffer.byteLength(JSON.stringify({ snapshot, questions }), "utf8") <=
        3_000_000,
      400,
      "Test content is too large; reduce question text/images",
    );
    const a = await Attempt.create({
      userId,
      testId,
      testVersion: t.version,
      snapshot,
      questions,
      startedAt: now,
      deadline: d.durationMinutes
        ? new Date(+now + d.durationMinutes * 60000)
        : null,
    });
    res.status(201).json(publicAttempt(a));
  } catch (e) {
    if (e.code === 11000) {
      const a = await Attempt.findOne({ userId, testId, status: "ACTIVE" });
      return res.json(publicAttempt(a));
    }
    throw e;
  }
});
attempts.get("/attempts", async (req, res) => {
  const rows = await Attempt.find({ userId: String(req.user._id) })
    .sort({ createdAt: -1 })
    .limit(100);
  const output = [];
  for (const a of rows) {
    const r =
      a.status === "ACTIVE" && a.deadline && a.deadline <= new Date()
        ? await finalize(a)
        : a;
    output.push({
      id: String(r._id),
      title: r.snapshot.title,
      status: r.status,
      subjectId: r.snapshot.academic.subjectId,
      startedAt: r.startedAt,
      evaluationState: r.evaluationState,
    });
  }
  res.json(output);
});
attempts.get("/analytics", async (req, res) => {
  const rows = await Attempt.find({
    userId: String(req.user._id),
    status: { $ne: "ACTIVE" },
  })
    .sort({ submittedAt: -1 })
    .limit(500);
  const results = rows.map(resultView);
  const final = results.filter((r) => !r.provisional);
  res.json({
    completed: rows.length,
    finalized: final.length,
    average: final.length
      ? Math.round(
          final.reduce(
            (s, r) => s + (r.awardedMarks / r.maximumMarks) * 100,
            0,
          ) / final.length,
        )
      : null,
    results: results.slice(0, 50),
  });
});
attempts.get("/attempts/:id/image", async (req, res) => {
  const key = z
    .string()
    .regex(/^question-images\/[a-f0-9]{64}\.(png|jpeg|webp)$/)
    .parse(req.query.key);
  const a = await owned(req.params.id, String(req.user._id));
  assert(
    a.questions.some((q) => q.imageKey === key),
    404,
    "Image not part of attempt",
  );
  assert(
    env.S3_BUCKET && env.S3_ACCESS_KEY_ID,
    503,
    "Storage is not configured",
  );
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT || undefined,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
  });
  res.json({
    url: await getSignedUrl(
      client,
      new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }),
      { expiresIn: 300 },
    ),
  });
});
attempts.get("/attempts/:id", async (req, res) =>
  res.json(publicAttempt(await owned(req.params.id, String(req.user._id)))),
);
attempts.put("/attempts/:id/answer", async (req, res) => {
  const d = answerSchema.parse(req.body);
  const a = await owned(req.params.id, String(req.user._id));
  assert(a.status === "ACTIVE", 409, "Attempt is finalized");
  const q = a.questions.find((q) => q._id === d.questionId);
  assert(q, 400, "Question not in this attempt");
  const current = a.answers[d.questionId];
  assert(
    d.version === (current?.version ?? 0),
    409,
    "A newer answer exists. Reload before resolving this conflict",
  );
  if (q.type.endsWith("CHOICE")) {
    assert(
      Array.isArray(d.value) &&
        d.value.every((v) => q.options.some((o) => o.id === v)),
      400,
      "Invalid option",
    );
    assert(
      new Set(d.value).size === d.value.length &&
        (q.type !== "SINGLE_CHOICE" || d.value.length <= 1),
      400,
      "Invalid selection",
    );
  } else assert(typeof d.value === "string", 400, "Text answer required");
  if (q.wordLimit && typeof d.value === "string")
    assert(
      d.value.trim().split(/\s+/u).filter(Boolean).length <= q.wordLimit,
      400,
      "Word limit exceeded",
    );
  const section = a.snapshot.sections.find((s) => s.id === q.sectionId);
  if (hasAnswer(d.value) && section.maxAnswers) {
    const other = a.questions.filter(
      (x) =>
        x.sectionId === q.sectionId &&
        x._id !== q._id &&
        hasAnswer(a.answers[x._id]?.value),
    ).length;
    assert(
      other < section.maxAnswers,
      400,
      "Internal choice limit reached; clear another answer first",
    );
  }
  const next = { ...d, version: d.version + 1, updatedAt: new Date() };
  assert(
    Buffer.byteLength(
      JSON.stringify({ ...a.answers, [d.questionId]: next }),
      "utf8",
    ) <= 6_000_000,
    400,
    "Total answer size exceeds the attempt limit",
  );
  const now = new Date();
  const updated = await Attempt.findOneAndUpdate(
    {
      _id: a._id,
      status: "ACTIVE",
      revision: a.revision,
      $or: [{ deadline: null }, { deadline: { $gt: now } }],
    },
    { $set: { [`answers.${d.questionId}`]: next }, $inc: { revision: 1 } },
    { returnDocument: "after" },
  );
  assert(updated, 409, "Attempt changed or timed out; reload");
  res.json({ answer: next, revision: updated.revision, serverNow: new Date() });
});
attempts.post("/attempts/:id/submit", async (req, res) => {
  const a = await owned(req.params.id, String(req.user._id));
  res.json(publicAttempt(await finalize(a)));
});
export function resultView(a) {
  const values = Object.values(a.evaluations);
  const pending = values.some(
    (e) => e.status === "PENDING" || e.status === "REVIEW",
  );
  const max = a.snapshot.sections.reduce((s, section) => {
    const qs = a.questions
      .filter((q) => q.sectionId === section.id)
      .map((q) => q.maximumMarks)
      .sort((a, b) => b - a);
    return (
      s +
      qs.slice(0, section.maxAnswers ?? qs.length).reduce((x, y) => x + y, 0)
    );
  }, 0);
  return {
    id: String(a._id),
    title: a.snapshot.title,
    status: a.status,
    provisional: pending,
    awardedMarks: values
      .filter((e) => e.status === "EVALUATED")
      .reduce((s, e) => s + e.awardedMarks, 0),
    maximumMarks: max,
    questions: a.questions,
    answers: a.answers,
    evaluations: a.evaluations,
    submittedAt: a.submittedAt,
  };
}
attempts.get("/attempts/:id/result", async (req, res) => {
  const a = await owned(req.params.id, String(req.user._id));
  assert(a.status !== "ACTIVE", 409, "Submit your test first");
  res.json(resultView(a));
});
attempts.get(
  "/reviews",
  allow("EVALUATOR", "ADMIN", "SUPER_ADMIN"),
  async (_req, res) => {
    const rows = await Attempt.find({
      status: { $ne: "ACTIVE" },
      evaluationState: { $in: ["REVIEW", "PENDING"] },
    })
      .sort({ submittedAt: 1 })
      .limit(50);
    res.json(rows.map((a) => ({ ...resultView(a), revision: a.revision })));
  },
);
attempts.post(
  "/reviews/:id",
  allow("EVALUATOR", "ADMIN", "SUPER_ADMIN"),
  async (req, res) => {
    const d = z
      .object({
        questionId: id,
        revision: z.number().int(),
        reason: z.string().min(10).max(2000),
        criteria: z
          .array(
            z.object({
              id: z.string(),
              awardedMarks: z.number().min(0),
              feedback: z.string().max(2000),
            }),
          )
          .max(30),
      })
      .parse(req.body);
    const a = await Attempt.findById(id.parse(req.params.id));
    assert(a && a.status !== "ACTIVE", 404, "Submitted attempt missing");
    const q = a.questions.find((q) => q._id === d.questionId);
    assert(q && isDescriptive(q.type), 400, "Descriptive question required");
    const { validateEvaluation } = await import("@boardtestify/domain");
    const e = validateEvaluation(q, {
      criteria: d.criteria,
      confidence: 1,
      detectedLanguage: "other",
      strengths: [],
      missingPoints: [],
      errors: [],
      improvementAdvice: [d.reason],
      requiresManualReview: false,
      reviewReason: null,
    });
    const history = {
      actor: String(req.user._id),
      reason: d.reason,
      previousMarks: a.evaluations[d.questionId]?.awardedMarks,
      at: new Date(),
    };
    const next = {
      ...e,
      status: "EVALUATED",
      reviewer: String(req.user._id),
      history: [...(a.evaluations[d.questionId]?.history ?? []), history].slice(
        -5,
      ),
    };
    const evaluations = { ...a.evaluations, [d.questionId]: next };
    const state = Object.values(evaluations).some((e) => e.status === "PENDING")
      ? "PENDING"
      : Object.values(evaluations).some((e) => e.status === "REVIEW")
        ? "REVIEW"
        : "COMPLETE";
    const updated = await Attempt.findOneAndUpdate(
      { _id: a._id, revision: d.revision },
      { $set: { evaluations, evaluationState: state }, $inc: { revision: 1 } },
      { returnDocument: "after" },
    );
    assert(updated, 409, "Review changed; reload");
    await Audit.create({
      actor: String(req.user._id),
      action: "EVALUATION_REVIEW",
      entityId: String(a._id),
      details: {
        questionId: q._id,
        ...history,
        previousEvaluation: {
          ...a.evaluations[d.questionId],
          history: undefined,
        },
      },
    });
    res.json(resultView(updated));
  },
);
// A durable MongoDB work queue. Leases recover after process termination. CAS updates
// prevent the worker from overwriting a human review or a concurrent answer.
export async function tick() {
  const expired = await Attempt.find({
    status: "ACTIVE",
    deadline: { $ne: null, $lte: new Date() },
  }).limit(50);
  for (const a of expired) {
    try {
      await finalize(a);
    } catch (e) {
      if (!(e instanceof HttpError && e.status === 409)) throw e;
    }
  }
  const a = await Attempt.findOneAndUpdate(
    {
      status: { $ne: "ACTIVE" },
      evaluationState: "PENDING",
      $or: [{ leaseUntil: null }, { leaseUntil: { $lt: new Date() } }],
    },
    { $set: { leaseUntil: new Date(Date.now() + 150000) } },
    { returnDocument: "after" },
  );
  if (!a) return;
  const pending = a.questions.find(
    (q) => a.evaluations[q._id]?.status === "PENDING",
  );
  if (!pending) return;
  const e = await evaluate(pending, a.answers[pending._id]?.value);
  const evaluations = { ...a.evaluations, [pending._id]: e };
  const state = Object.values(evaluations).some((e) => e.status === "PENDING")
    ? "PENDING"
    : Object.values(evaluations).some((e) => e.status === "REVIEW")
      ? "REVIEW"
      : "COMPLETE";
  await Attempt.updateOne(
    { _id: a._id, revision: a.revision },
    {
      $set: { evaluations, evaluationState: state, leaseUntil: null },
      $inc: { revision: 1 },
    },
  );
}
