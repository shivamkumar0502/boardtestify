import { Router } from "express";
import { z } from "zod";
import { id } from "@boardtestify/domain";
import { Academic, TestModel, Attempt } from "./models.js";
import { auth, assert } from "./lib.js";
import { concurrencyGate } from "./reliability.js";
export const series = Router();
series.use("/test-series", auth, concurrencyGate(20));
const scope = (user) => ({
  status: "PUBLISHED",
  "data.academic.classLevel": user.classLevel,
  "data.academic.stream": user.stream,
});
series.get("/test-series", async (req, res) => {
  const groups = await TestModel.aggregate([
    { $match: scope(req.user) },
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
  const subjects = await Academic.find({
    _id: { $in: groups.map((g) => g._id) },
    active: true,
    classLevel: req.user.classLevel,
    stream: req.user.stream,
  })
    .select("name session classLevel stream")
    .lean();
  const byId = new Map(subjects.map((s) => [String(s._id), s]));
  res.json(
    groups
      .filter((g) => byId.has(g._id))
      .map((g) => ({
        id: g._id,
        title: byId.get(g._id).name,
        session: byId.get(g._id).session,
        classLevel: req.user.classLevel,
        stream: req.user.stream,
        testCount: g.tests,
        freeTests: g.free,
        modes: g.modes,
      })),
  );
});
series.get("/test-series/:id/tests", async (req, res) => {
  const subjectId = id.parse(req.params.id);
  const d = z
    .object({
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
    .select("name session")
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
  if (d.chapterId) filter["data.academic.chapterId"] = d.chapterId;
  if (d.mode) filter["data.mode"] = d.mode;
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
      "data.title data.description data.mode data.durationMinutes data.premium data.sections data.academic.session version",
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
  res.json({
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
