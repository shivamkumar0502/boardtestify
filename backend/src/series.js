import { boardGuide, referenceFor } from "./bseb-catalog.js";
import { Router } from "express";
import { z } from "zod";
import { id } from "@boardtestify/domain";
import { Academic, TestModel, Attempt, Pattern } from "./models.js";
import { auth, assert } from "./lib.js";
import { concurrencyGate } from "./reliability.js";
export const series = Router();
series.use("/test-series", auth, concurrencyGate(20));
const scope = (user) => ({
  status: "PUBLISHED",
  "data.academic.classLevel": user.classLevel,
  "data.academic.stream": user.stream,
});
series.get("/test-series/board-guide", (req, res) =>
  res.json(boardGuide(req.user.classLevel, req.user.stream)),
);
series.get("/test-series", async (req, res) => {
  const subjects = await Academic.find({
    kind: "SUBJECT",
    active: true,
    classLevel: req.user.classLevel,
    stream: req.user.stream,
  })
    .sort({ session: -1, order: 1, name: 1 })
    .limit(100)
    .lean();
  const groups = await TestModel.aggregate([
    {
      $match: {
        ...scope(req.user),
        "data.academic.subjectId": { $in: subjects.map((s) => String(s._id)) },
      },
    },
    {
      $group: {
        _id: "$data.academic.subjectId",
        tests: { $sum: 1 },
        free: { $sum: { $cond: ["$data.premium", 0, 1] } },
        modes: { $addToSet: "$data.mode" },
      },
    },
    { $sort: { _id: 1 } },
    { $limit: 100 },
  ]).option({ maxTimeMS: 5000 });
  const counts = new Map(groups.map((g) => [g._id, g]));
  res.json(
    subjects.map((s) => {
      const g = counts.get(String(s._id));
      const ref = referenceFor(s);
      return {
        id: String(s._id),
        title: s.name,
        session: s.session,
        classLevel: req.user.classLevel,
        stream: req.user.stream,
        testCount: g?.tests || 0,
        freeTests: g?.free || 0,
        modes: g?.modes || [],
        reference: ref
          ? {
              referenceYear: ref.referenceYear,
              theoryMarks: ref.theoryMarks,
              otherAssessmentMarks: ref.otherAssessmentMarks,
              paperQuestionLabel: ref.paperQuestionLabel,
            }
          : null,
      };
    }),
  );
});
series.get("/test-series/:id/tests", async (req, res) => {
  const subjectId = id.parse(req.params.id);
  const d = z
    .object({
      kind: z.enum(["FULL_MOCK", "CHAPTER", "TOPIC", "SUBJECT"]).optional(),
      cursor: id.optional(),
      chapterId: id.optional(),
      mode: z.enum(["PRACTICE", "CBT", "BOARD"]).optional(),
      access: z.enum(["FREE", "PREMIUM"]).optional(),
      q: z.string().trim().max(80).default(""),
    })
    .parse(req.query);
  const subject = await Academic.findOne({
    _id: subjectId,
    kind: "SUBJECT",
    active: true,
    classLevel: req.user.classLevel,
    stream: req.user.stream,
  })
    .select("name session classLevel stream boardSubjectKey")
    .lean();
  assert(subject, 404, "Test series not found");
  const chapters = await Academic.find({
    kind: "CHAPTER",
    parentId: subjectId,
    session: subject.session,
    active: true,
    classLevel: req.user.classLevel,
    stream: req.user.stream,
  })
    .select("name")
    .limit(200)
    .lean();
  if (d.chapterId)
    assert(
      chapters.some((c) => String(c._id) === d.chapterId),
      404,
      "Chapter not found in this series",
    );
  const filter = { ...scope(req.user), "data.academic.subjectId": subjectId };
  if (d.kind === "FULL_MOCK") filter["data.mode"] = "BOARD";
  if (d.kind === "TOPIC") {
    filter["data.academic.topic"] = { $type: "string", $regex: /\S/ };
    filter["data.mode"] = { $ne: "BOARD" };
  }
  if (d.kind === "CHAPTER") {
    filter["data.academic.chapterId"] = { $exists: true, $nin: [null, ""] };
    filter.$or = [
      { "data.academic.topic": { $exists: false } },
      { "data.academic.topic": "" },
    ];
    filter["data.mode"] = { $ne: "BOARD" };
  }
  if (d.kind === "SUBJECT") {
    filter["data.academic.chapterId"] = { $in: [null, ""] };
    filter["data.academic.topic"] = { $in: [null, ""] };
    filter["data.mode"] = { $ne: "BOARD" };
  }
  if (d.chapterId) filter["data.academic.chapterId"] = d.chapterId;
  if (d.mode) {
    assert(
      d.kind !== "FULL_MOCK" || d.mode === "BOARD",
      400,
      "Full mocks use board mode",
    );
    assert(
      !["CHAPTER", "TOPIC", "SUBJECT"].includes(d.kind) || d.mode !== "BOARD",
      400,
      "Choose full mocks for board mode",
    );
    filter["data.mode"] = d.mode;
  }
  if (d.access) filter["data.premium"] = d.access === "PREMIUM";
  if (d.cursor) filter._id = { $lt: d.cursor };
  if (d.q)
    filter["data.title"] = {
      $regex: d.q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      $options: "i",
    };
  const found = await TestModel.find(filter)
    .sort({ _id: -1 })
    .limit(21)
    .select(
      "data.title data.description data.mode data.durationMinutes data.premium data.sections data.academic.session data.academic.chapterId data.academic.topic data.patternId version",
    )
    .maxTimeMS(5000)
    .lean();
  const rows = found.slice(0, 20),
    testIds = rows.map((t) => String(t._id));
  const attempts = await Attempt.aggregate([
    { $match: { userId: String(req.user._id), testId: { $in: testIds } } },
    { $sort: { createdAt: -1 } },
    {
      $group: {
        _id: "$testId",
        latest: { $first: { id: "$_id", status: "$status" } },
        active: {
          $max: {
            $cond: [
              { $eq: ["$status", "ACTIVE"] },
              { $toString: "$_id" },
              null,
            ],
          },
        },
      },
    },
  ]).option({ maxTimeMS: 5000 });
  const byTest = new Map(attempts.map((a) => [a._id, a]));
  const approved = await Pattern.findOne({
    status: "PUBLISHED",
    "data.academic.subjectId": subjectId,
    "data.academic.session": subject.session,
    "data.academic.classLevel": req.user.classLevel,
    "data.academic.stream": req.user.stream,
  })
    .sort({ updatedAt: -1 })
    .select("data")
    .lean();
  const reference = referenceFor(subject);
  res.json({
    paper: approved
      ? {
          ...approved.data,
          sections: approved.data.sections,
          sourceUrl: approved.data.officialSource,
          theoryMarks: approved.data.totalMarks,
          label: "Approved session layout",
        }
      : reference
        ? { ...reference, label: "2026 model-paper reference" }
        : null,
    chapters: chapters.map((c) => ({ id: String(c._id), title: c.name })),
    subject: { id: subjectId, title: subject.name, session: subject.session },
    rows: rows.map((t) => {
      const a = byTest.get(String(t._id));
      return {
        id: String(t._id),
        title: t.data.title,
        description: t.data.description,
        mode: t.data.mode,
        durationMinutes: t.data.durationMinutes,
        premium: !!t.data.premium,
        category:
          t.data.mode === "BOARD"
            ? "Full mock"
            : t.data.academic.topic
              ? "Topic test"
              : t.data.academic.chapterId
                ? "Chapter test"
                : "Subject practice",
        topic: t.data.academic.topic || null,
        marks:
          t.data.mode === "BOARD" &&
          approved &&
          t.data.patternId === String(approved._id)
            ? approved.data.totalMarks
            : null,
        questions: t.data.sections.reduce(
          (n, s) => n + (s.drawCount ?? s.questionIds.length),
          0,
        ),
        activeAttemptId: a?.active || null,
        resultAttemptId:
          a?.latest?.status !== "ACTIVE" ? a?.latest?.id || null : null,
      };
    }),
    nextCursor: found.length > 20 ? String(rows.at(-1)._id) : null,
  });
});
