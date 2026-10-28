import {
  questionSchema,
  testSchema,
  patternSchema,
} from "@boardtestify/domain";
import {
  Academic,
  QuestionModel,
  TestModel,
  Pattern,
  Audit,
} from "./models.js";
import { assert, hash } from "./lib.js";
import { starterContent } from "./starter-content.js";
import { catalogFor } from "./bseb-catalog.js";
import { validateAcademic } from "./content.js";
import { validatePatternForTest } from "./management.js";
const author = "boardtestify-starter-v1";
export const starterId = "class10-starter";
const identity = (value) => hash(`${author}:${value}`).slice(0, 24);
export async function seedStarter() {
  const packs = starterContent();
  for (const pack of packs) {
    const scope = { session: "2026-27", classLevel: "10", stream: "GENERAL" };
    let subject = await Academic.findOne({
      ...scope,
      kind: "SUBJECT",
      name: pack.subject,
      active: true,
    }).lean();
    if (!subject)
      subject = await Academic.findOneAndUpdate(
        { _id: identity(`subject:${pack.subject}`) },
        {
          $setOnInsert: {
            ...scope,
            kind: "SUBJECT",
            name: pack.subject,
            active: true,
            verified: false,
            syllabusVersion: "Original starter practice",
            creator: author,
          },
        },
        { upsert: true, returnDocument: "after" },
      ).lean();
    assert(
      subject.active,
      409,
      "This starter subject is inactive. Review its academic settings first.",
    );
    const academic = { ...scope, subjectId: String(subject._id) };
    let layout;
    if (pack.fullMock) {
      const ref = catalogFor("10", "GENERAL").find(
        (s) => s.name === "Mathematics",
      );
      const data = patternSchema.parse({
        title: "Mathematics · starter mock · 2026 reference layout",
        academic,
        versionLabel: "BSEB model paper 2026 · review for selected session",
        officialSource: ref.sourceUrl,
        verifiedAt: "2026-10-28T00:00:00.000Z",
        durationMinutes: ref.durationMinutes,
        readingMinutes: ref.readingMinutes,
        totalMarks: ref.theoryMarks,
        sections: ref.sections,
      });
      layout = await Pattern.findOneAndUpdate(
        { _id: identity("math-layout") },
        {
          $setOnInsert: { data, status: "DRAFT", creator: author, version: 1 },
        },
        { upsert: true, returnDocument: "after" },
      ).lean();
    }
    const rows = pack.questions.map((entry, i) => ({
      _id: identity(`${pack.id}:q:${i}`),
      hash: hash(`${author}:${pack.id}:${i}`),
      data: questionSchema.parse({
        ...entry,
        academic,
        language:
          pack.subject === "Hindi" || pack.subject === "Sanskrit" ? "hi" : "en",
        source:
          "Original foundation practice by BoardTestify. Not an official BSEB question, PYQ or complete syllabus. Review the question, key and rubric before publication.",
        difficulty: "EASY",
        isPYQ: false,
      }),
    }));
    await QuestionModel.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $setOnInsert: {
              ...row,
              status: "DRAFT",
              version: 1,
              creator: author,
            },
          },
          upsert: true,
        },
      })),
    );
    const sections = pack.fullMock
      ? pack.sections.map((s) => ({
          id: s.id,
          title: layout.data.sections.find((p) => p.id === s.id).title,
          questionIds: rows.slice(s.from, s.from + s.count).map((q) => q._id),
          drawCount: s.count,
          maxAnswers: s.maxAnswers,
          allowedTypes: layout.data.sections.find((p) => p.id === s.id).types,
          choicePolicy: "FIRST_IN_PAPER",
          instructions: `Answer ${s.maxAnswers} of ${s.count}; only the first answered items in paper order count.`,
        }))
      : [
          {
            id: "practice",
            title: pack.title,
            questionIds: rows.map((q) => q._id),
            maxAnswers: 10,
            instructions: "Answer all ten questions. No negative marking.",
          },
        ];
    const data = testSchema.parse({
      title: pack.title,
      academic,
      mode: pack.fullMock ? "BOARD" : "PRACTICE",
      durationMinutes: pack.fullMock ? 195 : 15,
      readingMinutes: pack.fullMock ? 15 : 0,
      premium: false,
      feedbackMode: pack.fullMock ? "AFTER_SUBMISSION" : "IMMEDIATE",
      description: pack.fullMock
        ? "138 original foundation questions: 100 MCQs, 30 short and 8 long answers; answer 50/15/4 for 100 marks. Full-length 2026 reference layout, not an official paper or complete syllabus coverage. Descriptive marks require review."
        : "10 original foundation MCQs with keys and explanations. Free practice, not an official board paper or complete syllabus.",
      ...(layout
        ? {
            patternId: String(layout._id),
            officialSource: layout.data.officialSource,
            verifiedAt: layout.data.verifiedAt,
            patternVersion: layout.data.versionLabel,
          }
        : {}),
      sections,
    });
    await TestModel.updateOne(
      { _id: identity(`test:${pack.id}`) },
      { $setOnInsert: { data, status: "DRAFT", version: 1, creator: author } },
      { upsert: true },
    );
  }
  return {
    tests: packs.length,
    questions: packs.reduce((n, p) => n + p.questions.length, 0),
    status: "DRAFT",
  };
}
export async function starterReview() {
  const tests = await TestModel.find({
    _id: { $in: starterContent().map((p) => identity(`test:${p.id}`)) },
  })
    .sort({ "data.mode": -1, "data.academic.subjectId": 1 })
    .lean();
  assert(tests.length === 7, 409, "Import the Class 10 starter pack first.");
  const ids = [
    ...new Set(
      tests.flatMap((t) => t.data.sections.flatMap((s) => s.questionIds)),
    ),
  ];
  assert(
    ids.length <= 300,
    409,
    "This pack was expanded. Review it through the normal content editor.",
  );
  const questions = await QuestionModel.find({ _id: { $in: ids } }).lean();
  assert(
    questions.length === ids.length,
    409,
    "A question is missing. Repair the draft before publication.",
  );
  const patterns = await Pattern.find({
    _id: { $in: tests.map((t) => t.data.patternId).filter(Boolean) },
  }).lean();
  // Include reviewed data and versions, but not publication metadata: safe retries
  // can finish a partly published pack; teacher edits always invalidate this token.
  const snapshot = [...tests, ...questions, ...patterns]
    .sort((a, b) => String(a._id).localeCompare(String(b._id)))
    .map((r) => ({
      id: String(r._id),
      version: r.version,
      creator: r.creator,
      data: r.data,
    }));
  return {
    tests,
    questions,
    patterns,
    reviewToken: hash(JSON.stringify(snapshot)),
  };
}
export async function publishStarter(req, input) {
  const review = await starterReview();
  assert(
    review.reviewToken === input.reviewToken,
    409,
    "Content changed. Reopen the review before publishing.",
  );
  const test = review.tests.find((t) => String(t._id) === input.testId);
  assert(test, 400, "Choose a test from this starter pack.");
  const data = testSchema.parse(test.data);
  await validateAcademic(data.academic);
  const ids = data.sections.flatMap((s) => s.questionIds),
    questions = review.questions.filter((q) => ids.includes(String(q._id)));
  for (const q of questions) {
    questionSchema.parse(q.data);
    assert(
      q.data.academic.subjectId === data.academic.subjectId &&
        q.data.academic.session === data.academic.session &&
        q.data.academic.classLevel === data.academic.classLevel &&
        q.data.academic.stream === data.academic.stream,
      400,
      "Questions must match test academic settings.",
    );
    assert(
      q.creator !== String(req.user._id),
      400,
      "Another administrator must review your edited questions.",
    );
  }
  for (const section of data.sections)
    if (section.allowedTypes)
      assert(
        questions
          .filter((q) => section.questionIds.includes(String(q._id)))
          .every((q) => section.allowedTypes.includes(q.data.type)),
        400,
        "Question type is not allowed in this section.",
      );
  const chapterIds = [
    ...new Set(questions.map((q) => q.data.academic.chapterId).filter(Boolean)),
  ];
  if (chapterIds.length)
    assert(
      (await Academic.countDocuments({
        _id: { $in: chapterIds },
        kind: "CHAPTER",
        parentId: data.academic.subjectId,
        session: data.academic.session,
        active: true,
      })) === chapterIds.length,
      400,
      "A question chapter is not active in this subject/session.",
    );
  const pattern = review.patterns.find((p) => String(p._id) === data.patternId);
  if (data.mode === "BOARD") {
    assert(pattern, 400, "Review the mock's layout first.");
    patternSchema.parse(pattern.data);
    assert(
      Date.parse(pattern.data.verifiedAt) <= Date.now(),
      400,
      "Layout verification date cannot be in the future.",
    );
    assert(
      pattern.creator !== String(req.user._id),
      400,
      "Another administrator must review your edited layout.",
    );
    const changed = await Pattern.updateOne(
      { _id: pattern._id, version: pattern.version },
      { $set: { status: "PUBLISHED", reviewer: String(req.user._id) } },
    );
    assert(changed.matchedCount, 409, "Layout changed. Reopen the review.");
    await validatePatternForTest(data, questions);
  }
  const result = await QuestionModel.bulkWrite(
    questions.map((q) => ({
      updateOne: {
        filter: {
          _id: q._id,
          version: q.version,
          creator: { $ne: String(req.user._id) },
        },
        update: {
          $set: { status: "PUBLISHED", reviewer: String(req.user._id) },
        },
      },
    })),
  );
  assert(
    result.matchedCount === questions.length,
    409,
    "Questions changed. Reopen the review.",
  );
  assert(
    (await QuestionModel.countDocuments({
      _id: { $in: ids },
      status: "PUBLISHED",
    })) === ids.length,
    409,
    "A question changed. Reopen the review.",
  );
  const published = await TestModel.updateOne(
    { _id: test._id, version: test.version },
    { $set: { data, status: "PUBLISHED", reviewer: String(req.user._id) } },
  );
  assert(published.matchedCount, 409, "Test changed. Reopen the review.");
  await Audit.updateOne(
    {
      _id: identity(`review:${input.reviewToken}:${test._id}:${req.user._id}`),
    },
    {
      $setOnInsert: {
        actor: String(req.user._id),
        action: "STARTER_TEST_REVIEW_PUBLISH",
        entityId: String(test._id),
        details: {
          reviewToken: input.reviewToken,
          questions: questions.length,
          patternId: data.patternId,
        },
      },
    },
    { upsert: true },
  );
  return {
    testId: String(test._id),
    status: "PUBLISHED",
    questions: questions.length,
  };
}
