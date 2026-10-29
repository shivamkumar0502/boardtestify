import { Router } from "express";
import { Attempt, Academic } from "./models.js";
import { auth } from "./lib.js";

export const analytics = Router();
analytics.use(auth);

const label = (value, fallback) =>
  typeof value === "string" && value.trim() ? value.trim() : fallback;

analytics.get("/analytics/detailed", async (req, res) => {
  const rows = await Attempt.find({
    userId: String(req.user._id),
    status: { $ne: "ACTIVE" },
  })
    .select("snapshot questions evaluations summary status submittedAt startedAt")
    .sort({ submittedAt: -1, createdAt: -1 })
    .limit(100)
    .lean();

  const academicIds = new Set();
  for (const attempt of rows) {
    const academic = attempt.snapshot?.academic || {};
    if (academic.subjectId) academicIds.add(String(academic.subjectId));
    for (const question of attempt.questions || []) {
      if (question.academic?.subjectId) academicIds.add(String(question.academic.subjectId));
      if (question.academic?.chapterId) academicIds.add(String(question.academic.chapterId));
    }
  }
  const academicRows = academicIds.size
    ? await Academic.find({ _id: { $in: [...academicIds] } }).select("name kind").lean()
    : [];
  const academicNames = new Map(academicRows.map((row) => [String(row._id), row.name]));

  const subjects = new Map();
  const chapters = new Map();
  const trend = [];
  let completed = 0;
  let finalized = 0;
  let finalizedPercentTotal = 0;

  for (const attempt of [...rows].reverse()) {
    if (attempt.status === "ACTIVE") continue;
    completed += 1;
    const summary = attempt.summary || {};
    const isFinal = summary.provisional === false;
    const maximumMarks = Number(summary.maximumMarks) || 0;
    const awardedMarks = Number(summary.awardedMarks) || 0;
    const percent = maximumMarks > 0
      ? Math.max(0, Math.min(100, (awardedMarks / maximumMarks) * 100))
      : null;
    if (isFinal && percent !== null) {
      finalized += 1;
      finalizedPercentTotal += percent;
    }
    trend.push({
      id: String(attempt._id),
      title: label(attempt.snapshot?.title, "BoardTestify test"),
      date: attempt.submittedAt || attempt.startedAt || attempt.createdAt,
      percent: isFinal ? percent : null,
      provisional: !isFinal,
    });

    const questions = attempt.questions || [];
    const subjectId = String(
      attempt.snapshot?.academic?.subjectId ||
      questions.find((q) => q.academic?.subjectId)?.academic?.subjectId ||
      "unknown"
    );
    const subjectName = academicNames.get(subjectId) || label(
      attempt.snapshot?.academic?.subjectName || attempt.snapshot?.academic?.subject,
      subjectId === "unknown" ? "Unclassified subject" : "Subject"
    );
    if (!subjects.has(subjectId)) {
      subjects.set(subjectId, {
        id: subjectId, name: subjectName, attempts: 0,
        scoredAttempts: 0, percentTotal: 0, questions: 0, correctOrFull: 0,
      });
    }
    const subject = subjects.get(subjectId);
    subject.attempts += 1;
    if (isFinal && percent !== null) {
      subject.scoredAttempts += 1;
      subject.percentTotal += percent;
    }

    for (const question of questions) {
      const qAcademic = question.academic || {};
      const evaluation = attempt.evaluations?.[question._id];
      if (!evaluation || evaluation.status !== "EVALUATED") continue;
      const qMax = Number(question.maximumMarks) || Number(evaluation.maximumMarks) || 0;
      const qMarks = Number(evaluation.awardedMarks);
      if (!(qMax > 0) || !Number.isFinite(qMarks)) continue;
      subject.questions += 1;
      if (qMarks >= qMax) subject.correctOrFull += 1;

      const chapterId = String(qAcademic.chapterId || "");
      const topic = label(qAcademic.topic, "");
      if (!chapterId && !topic) continue;
      const key = chapterId || `${subjectId}:topic:${topic.toLowerCase()}`;
      if (!chapters.has(key)) {
        chapters.set(key, {
          id: key,
          name: academicNames.get(chapterId) || topic || "Chapter",
          subject: subjectName,
          attempts: 0, marks: 0, maximum: 0, questions: 0, missed: 0,
        });
      }
      const chapter = chapters.get(key);
      chapter.attempts += 1;
      chapter.marks += Math.max(0, Math.min(qMax, qMarks));
      chapter.maximum += qMax;
      chapter.questions += 1;
      if (qMarks < qMax) chapter.missed += 1;
    }
  }

  const subjectRows = [...subjects.values()]
    .map((s) => ({
      ...s,
      averagePercent: s.scoredAttempts
        ? Math.round(s.percentTotal / s.scoredAttempts)
        : null,
      accuracyPercent: s.questions
        ? Math.round((s.correctOrFull / s.questions) * 100)
        : null,
    }))
    .sort((a, b) => (a.averagePercent ?? 101) - (b.averagePercent ?? 101));

  const chapterRows = [...chapters.values()]
    .map((c) => ({
      ...c,
      percent: c.maximum > 0 ? Math.round((c.marks / c.maximum) * 100) : null,
    }))
    .sort((a, b) => (a.percent ?? 101) - (b.percent ?? 101))
    .slice(0, 12);

  res.json({
    completed,
    finalized,
    averagePercent: finalized ? Math.round(finalizedPercentTotal / finalized) : null,
    pending: completed - finalized,
    subjects: subjectRows,
    weakAreas: chapterRows.filter((c) => c.percent !== null).slice(0, 6),
    chapters: chapterRows,
    trend: trend.slice(-12).reverse(),
  });
});
