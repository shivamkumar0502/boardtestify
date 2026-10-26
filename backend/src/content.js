import { Router } from "express";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import {
  questionSchema,
  testSchema,
  id,
  sanitizeExport,
} from "@boardtestify/domain";
import { Academic, QuestionModel, TestModel, Audit, User } from "./models.js";
import { auth, allow, assert, hash } from "./lib.js";
import { draftQuestions } from "./evaluation.js";
export const content = Router();
const editors = allow("CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN");
const publishers = allow("ADMIN", "SUPER_ADMIN");
async function audit(req, action, entityId, details) {
  await Audit.create({
    actor: String(req.user._id),
    action,
    entityId,
    details,
  });
}
export async function validateAcademic(a) {
  const s = await Academic.findOne({
    _id: a.subjectId,
    kind: "SUBJECT",
    active: true,
    session: a.session,
    classLevel: a.classLevel,
    stream: a.stream,
  });
  assert(s, 400, "Subject does not match academic selection");
  if (a.chapterId)
    assert(
      await Academic.exists({
        _id: a.chapterId,
        kind: "CHAPTER",
        parentId: a.subjectId,
        active: true,
        session: a.session,
      }),
      400,
      "Chapter does not belong to subject/session",
    );
}
content.get("/academics", async (req, res) => {
  const filter = { active: true };
  for (const key of ["session", "classLevel", "stream", "kind", "parentId"])
    if (typeof req.query[key] === "string") filter[key] = req.query[key];
  res.json(
    await Academic.find(filter).sort({ order: 1, name: 1 }).limit(500).lean(),
  );
});
content.get("/tests", auth, async (req, res) => {
  const u = req.user;
  const rows = await TestModel.find({
    status: "PUBLISHED",
    "data.academic.classLevel": u.classLevel,
    "data.academic.stream": u.stream,
  })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  res.json(
    rows.map((r) => ({
      id: String(r._id),
      ...r.data,
      sections: r.data.sections.map((s) => ({
        ...s,
        questionIds: undefined,
        count: s.drawCount ?? s.questionIds.length,
      })),
      version: r.version,
    })),
  );
});
content.use("/admin", auth);
content.get("/admin/academics", editors, async (_req, res) =>
  res.json(
    await Academic.find().sort({ order: 1, name: 1 }).limit(1000).lean(),
  ),
);
const academicInput = z.object({
  kind: z.enum(["SUBJECT", "CHAPTER", "TOPIC"]),
  name: z.string().trim().min(1).max(200),
  session: z.string().regex(/^\d{4}-\d{2}$/),
  classLevel: z.enum(["10", "12"]),
  stream: z.enum(["GENERAL", "ARTS", "SCIENCE", "COMMERCE"]),
  parentId: id.optional(),
  syllabusVersion: z.string().min(1).max(100),
  sourceUrl: z.string().url().optional(),
  verified: z.boolean().default(false),
  active: z.boolean().default(true),
  order: z.number().int().min(0).default(0),
});
content.post("/admin/academics", editors, async (req, res) => {
  const d = academicInput.parse(req.body);
  assert(
    (d.classLevel === "10") === (d.stream === "GENERAL"),
    400,
    "Invalid stream",
  );
  if (d.kind !== "SUBJECT") {
    assert(d.parentId, 400, "Parent required");
    const parent = await Academic.findById(d.parentId);
    assert(
      parent &&
        parent.kind === (d.kind === "CHAPTER" ? "SUBJECT" : "CHAPTER") &&
        parent.session === d.session &&
        parent.classLevel === d.classLevel &&
        parent.stream === d.stream,
      400,
      "Parent does not match hierarchy",
    );
  }
  assert(!d.verified || d.sourceUrl, 400, "Verified records need a source");
  const r = await Academic.create(d);
  await audit(req, "ACADEMIC_CREATE", String(r._id));
  res.status(201).json(r);
});
content.patch("/admin/academics/:id", editors, async (req, res) => {
  const d = z
    .object({
      name: z.string().min(1).max(200).optional(),
      active: z.boolean().optional(),
      order: z.number().int().min(0).optional(),
    })
    .strict()
    .parse(req.body);
  const r = await Academic.findByIdAndUpdate(
    id.parse(req.params.id),
    { $set: d },
    { returnDocument: "after" },
  );
  assert(r, 404, "Record missing");
  await audit(req, "ACADEMIC_UPDATE", String(r._id), d);
  res.json(r);
});
content.get("/admin/questions", editors, async (req, res) => {
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(10000)
    .default(1)
    .parse(req.query.page);
  const filter = {};
  if (req.query.status)
    filter.status = z.enum(["DRAFT", "PUBLISHED"]).parse(req.query.status);
  const [rows, total] = await Promise.all([
    QuestionModel.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * 25)
      .limit(25)
      .lean(),
    QuestionModel.countDocuments(filter),
  ]);
  res.json({ rows, total, page });
});
content.post("/admin/questions", editors, async (req, res) => {
  const d = questionSchema.parse(req.body);
  await validateAcademic(d.academic);
  const q = await QuestionModel.create({
    data: d,
    hash: hash(JSON.stringify([d.academic, d.text, d.language])),
    creator: String(req.user._id),
  });
  await audit(req, "QUESTION_CREATE", String(q._id));
  res.status(201).json(q);
});
content.put("/admin/questions/:id", editors, async (req, res) => {
  const d = questionSchema.parse(req.body);
  await validateAcademic(d.academic);
  const q = await QuestionModel.findById(id.parse(req.params.id));
  assert(q, 404, "Question missing");
  q.data = d;
  q.hash = hash(JSON.stringify([d.academic, d.text, d.language]));
  q.status = "DRAFT";
  q.reviewer = undefined;
  q.version += 1;
  await q.save();
  await audit(req, "QUESTION_UPDATE", String(q._id));
  res.json(q);
});
content.post("/admin/questions/:id/publish", publishers, async (req, res) => {
  const q = await QuestionModel.findById(id.parse(req.params.id));
  assert(q, 404, "Question missing");
  questionSchema.parse(q.data);
  await validateAcademic(q.data.academic);
  assert(
    q.creator !== String(req.user._id),
    400,
    "Another administrator must review this question",
  );
  q.status = "PUBLISHED";
  q.reviewer = String(req.user._id);
  await q.save();
  await audit(req, "QUESTION_PUBLISH", String(q._id));
  res.json(q);
});
content.get("/admin/tests", editors, async (_req, res) =>
  res.json(await TestModel.find().sort({ createdAt: -1 }).limit(200).lean()),
);
content.post("/admin/tests", editors, async (req, res) => {
  const d = testSchema.parse(req.body);
  await validateAcademic(d.academic);
  const t = await TestModel.create({ data: d, creator: String(req.user._id) });
  await audit(req, "TEST_CREATE", String(t._id));
  res.status(201).json(t);
});
content.put("/admin/tests/:id", editors, async (req, res) => {
  const d = testSchema.parse(req.body);
  await validateAcademic(d.academic);
  const t = await TestModel.findById(id.parse(req.params.id));
  assert(t, 404, "Test missing");
  t.data = d;
  t.status = "DRAFT";
  t.version += 1;
  await t.save();
  await audit(req, "TEST_UPDATE", String(t._id));
  res.json(t);
});
content.post("/admin/tests/:id/publish", publishers, async (req, res) => {
  const t = await TestModel.findById(id.parse(req.params.id));
  assert(t, 404, "Test missing");
  const d = testSchema.parse(t.data);
  await validateAcademic(d.academic);
  assert(
    d.mode !== "BOARD" || (d.officialSource && d.verifiedAt),
    400,
    "Board-pattern tests require verified official source/date",
  );
  const ids = d.sections.flatMap((s) => s.questionIds);
  const qs = await QuestionModel.find({
    _id: { $in: ids },
    status: "PUBLISHED",
  });
  assert(
    qs.length === ids.length,
    400,
    "All questions must be reviewed and published",
  );
  assert(
    qs.every(
      (q) =>
        q.data.academic.subjectId === d.academic.subjectId &&
        q.data.academic.session === d.academic.session &&
        q.data.academic.classLevel === d.academic.classLevel &&
        q.data.academic.stream === d.academic.stream,
    ),
    400,
    "Questions must match subject and session",
  );
  t.status = "PUBLISHED";
  t.reviewer = String(req.user._id);
  await t.save();
  await audit(req, "TEST_PUBLISH", String(t._id));
  res.json(t);
});
content.get("/admin/import-template", editors, (_req, res) => {
  res
    .type("text/csv")
    .attachment("boardtestify-question-template.csv")
    .send("question_json\r\n");
});
// CSV/XLSX has one question_json column: a complete validated Question object per row.
content.post("/admin/import/preview", editors, async (req, res) => {
  const d = z
    .object({
      format: z.enum(["csv", "xlsx"]),
      base64: z.string().max(2_800_000),
    })
    .parse(req.body);
  const buffer = Buffer.from(d.base64, "base64");
  assert(buffer.length <= 2_000_000, 413, "File too large");
  let rows;
  if (d.format === "csv")
    rows = parse(buffer, {
      columns: true,
      bom: true,
      skip_empty_lines: true,
      max_record_size: 100000,
    });
  else {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    assert(wb.worksheets.length === 1, 400, "Use one worksheet");
    const ws = wb.worksheets[0];
    assert(
      ws.getRow(1).getCell(1).value === "question_json",
      400,
      "First header must be question_json",
    );
    rows = [];
    ws.eachRow((r, n) => {
      if (n > 1) rows.push({ question_json: r.getCell(1).value });
    });
  }
  assert(rows.length <= 100, 400, "Maximum 100 rows per import");
  const result = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      assert(
        typeof rows[i].question_json === "string",
        400,
        "Plain JSON cell required; formulas are not allowed",
      );
      const q = questionSchema.parse(JSON.parse(rows[i].question_json));
      await validateAcademic(q.academic);
      const duplicate = !!(await QuestionModel.exists({
        hash: hash(JSON.stringify([q.academic, q.text, q.language])),
      }));
      result.push({
        row: i + 2,
        question: q,
        duplicate,
        error: duplicate ? "Duplicate question" : null,
      });
    } catch (e) {
      result.push({
        row: i + 2,
        error: e instanceof Error ? e.message : "Invalid row",
      });
    }
  }
  res.json(result);
});
content.post("/admin/import/confirm", editors, async (req, res) => {
  const rows = z.array(questionSchema).min(1).max(100).parse(req.body);
  const results = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      const q = rows[i];
      await validateAcademic(q.academic);
      const record = await QuestionModel.create({
        data: q,
        hash: hash(JSON.stringify([q.academic, q.text, q.language])),
        creator: String(req.user._id),
      });
      results.push({ row: i + 2, id: record._id, status: "DRAFT" });
    } catch (e) {
      results.push({
        row: i + 2,
        error: e.code === 11000 ? "Duplicate" : String(e),
      });
    }
  }
  await audit(req, "IMPORT", "batch", { rows: results });
  res.status(201).json(results);
});
content.post("/admin/ai-draft", editors, async (req, res) => {
  const d = z
    .object({
      academic: questionSchema.innerType().shape.academic,
      topic: z.string().min(1).max(500),
      count: z.number().int().min(1).max(10),
      language: z.enum(["hi", "en"]),
      type: z.enum(["SINGLE_CHOICE", "SHORT_ANSWER", "LONG_ANSWER"]),
      maximumMarks: z.number().positive().max(20),
      sourceMaterial: z.string().max(20000).default(""),
    })
    .parse(req.body);
  await validateAcademic(d.academic);
  res.json(await draftQuestions(d));
});
content.get("/admin/users", publishers, async (_req, res) =>
  res.json(
    await User.find()
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean(),
  ),
);
content.patch("/admin/users/:id", allow("SUPER_ADMIN"), async (req, res) => {
  const d = z
    .object({
      role: z
        .enum([
          "STUDENT",
          "CONTENT_EDITOR",
          "EVALUATOR",
          "ADMIN",
          "SUPER_ADMIN",
        ])
        .optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .parse(req.body);
  assert(
    req.params.id !== String(req.user._id),
    400,
    "Cannot alter your own permissions",
  );
  const u = await User.findByIdAndUpdate(
    id.parse(req.params.id),
    { $set: d, $inc: { authVersion: 1 } },
    { returnDocument: "after" },
  ).select("-passwordHash");
  assert(u, 404, "User missing");
  await audit(req, "USER_UPDATE", String(u._id), d);
  res.json(u);
});
content.get("/admin/audit", allow("SUPER_ADMIN"), async (_req, res) =>
  res.json(await Audit.find().sort({ createdAt: -1 }).limit(200).lean()),
);
content.get("/admin/export", editors, async (_req, res) => {
  const rows = await QuestionModel.find().limit(1000).lean();
  res
    .type("text/csv")
    .attachment("questions.csv")
    .send(
      "question_json\r\n" +
        rows
          .map(
            (r) =>
              '"' +
              sanitizeExport(JSON.stringify(r.data)).replaceAll('"', '""') +
              '"',
          )
          .join("\r\n"),
    );
});
