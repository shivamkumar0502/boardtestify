import { Router } from "express";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import ExcelJS from "exceljs";
import yauzl from "yauzl";
import {
  questionSchema,
  testSchema,
  id,
  sanitizeExport,
} from "@boardtestify/domain";
import { Academic, QuestionModel, TestModel, Audit, User } from "./models.js";
import { auth, allow, assert, hash, HttpError } from "./lib.js";
import { draftQuestions } from "./evaluation.js";
import { validatePatternForTest } from "./management.js";
import { concurrencyGate } from "./reliability.js";
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
content.get("/admin/academics", editors, async (req, res) => {
  const filter = z
    .object({
      session: z.string().max(20).optional(),
      classLevel: z.enum(["10", "12"]).optional(),
      stream: z.enum(["GENERAL", "ARTS", "SCIENCE", "COMMERCE"]).optional(),
    })
    .parse(req.query);
  res.json(
    await Academic.find(filter).sort({ order: 1, name: 1 }).limit(1000).lean(),
  );
});
const academicInput = z.object({
  kind: z.enum(["SUBJECT", "CHAPTER", "TOPIC"]),
  name: z.string().trim().min(1).max(200),
  session: z.string().regex(/^\d{4}-\d{2}$/),
  classLevel: z.enum(["10", "12"]),
  stream: z.enum(["GENERAL", "ARTS", "SCIENCE", "COMMERCE"]),
  parentId: id.optional(),
  syllabusVersion: z.string().min(1).max(100),
  sourceUrl: z
    .string()
    .url()
    .refine((v) => /^https?:\/\//i.test(v), "Use an HTTP or HTTPS source URL")
    .optional(),
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
  const r = await Academic.create({
    ...d,
    verified: false,
    creator: String(req.user._id),
  });
  await audit(req, "ACADEMIC_CREATE", String(r._id));
  res.status(201).json(r);
});
content.patch("/admin/academics/:id", editors, async (req, res) => {
  const d = z
    .object({
      name: z.string().min(1).max(200).optional(),
      active: z.boolean().optional(),
      order: z.number().int().min(0).optional(),
      sourceUrl: z
        .string()
        .url()
        .refine(
          (v) => /^https?:\/\//i.test(v),
          "Use an HTTP or HTTPS source URL",
        )
        .optional(),
      syllabusVersion: z.string().min(1).max(100).optional(),
    })
    .strict()
    .parse(req.body);
  const r = await Academic.findByIdAndUpdate(
    id.parse(req.params.id),
    {
      $set: {
        ...d,
        ...(d.name || d.sourceUrl || d.syllabusVersion
          ? {
              verified: false,
              creator: String(req.user._id),
              reviewer: null,
              verifiedAt: null,
            }
          : {}),
      },
    },
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
  for (const key of [
    "subjectId",
    "chapterId",
    "classLevel",
    "stream",
    "session",
  ])
    if (typeof req.query[key] === "string")
      filter[`data.academic.${key}`] = req.query[key];
  if (req.query.type)
    filter["data.type"] = z
      .enum([
        "SINGLE_CHOICE",
        "MULTIPLE_CHOICE",
        "SHORT_ANSWER",
        "LONG_ANSWER",
        "NUMERICAL",
        "IMAGE_BASED",
      ])
      .parse(req.query.type);
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
  q.creator = String(req.user._id);
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
  for (const section of d.sections)
    if (section.allowedTypes)
      assert(
        qs
          .filter((q) => section.questionIds.includes(String(q._id)))
          .every((q) => section.allowedTypes.includes(q.data.type)),
        400,
        "Question type is not allowed in this section",
      );
  await validatePatternForTest(d, qs);
  t.data = d;
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
content.post(
  "/admin/import/preview",
  editors,
  concurrencyGate(2),
  async (req, res) => {
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
      validateWorkbookArchive(buffer);
      await inspectWorkbookInflation(buffer);
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
  },
);
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
content.post(
  "/admin/ai-draft",
  editors,
  concurrencyGate(2),
  async (req, res) => {
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
  },
);
// Inspect central-directory sizes before inflating an XLSX zip into memory.
export function validateWorkbookArchive(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert(end >= 0 && end + 22 <= buffer.length, 400, "Invalid Excel archive");
  const count = buffer.readUInt16LE(end + 10);
  let offset = buffer.readUInt32LE(end + 16),
    total = 0;
  assert(
    count > 0 && count <= 300 && offset < end,
    400,
    "Excel archive is too complex",
  );
  for (let i = 0; i < count; i++) {
    assert(
      offset + 46 <= end && buffer.readUInt32LE(offset) === 0x02014b50,
      400,
      "Invalid Excel directory",
    );
    const size = buffer.readUInt32LE(offset + 24),
      compressed = buffer.readUInt32LE(offset + 20);
    total += size;
    assert(
      size <= 4_000_000 &&
        total <= 10_000_000 &&
        size <= Math.max(100000, compressed * 200),
      413,
      "Excel archive expands beyond allowed limits",
    );
    offset +=
      46 +
      buffer.readUInt16LE(offset + 28) +
      buffer.readUInt16LE(offset + 30) +
      buffer.readUInt16LE(offset + 32);
  }
  assert(offset <= end, 400, "Invalid Excel archive bounds");
}
export function inspectWorkbookInflation(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, validateEntrySizes: true },
      (err, zip) => {
        if (err) return reject(new HttpError(400, "Invalid Excel archive"));
        let total = 0,
          count = 0,
          settled = false;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          zip.close();
          error ? reject(error) : resolve();
        };
        const timer = setTimeout(
          () => finish(new HttpError(400, "Excel inspection timed out")),
          5000,
        );
        zip.on("error", () =>
          finish(new HttpError(400, "Invalid Excel archive")),
        );
        zip.on("end", () => finish());
        zip.on("entry", (entry) => {
          if (++count > 300 || entry.uncompressedSize > 4_000_000)
            return finish(
              new HttpError(400, "Excel archive exceeds allowed size"),
            );
          zip.openReadStream(entry, (error, stream) => {
            if (error)
              return finish(new HttpError(400, "Invalid compressed entry"));
            let bytes = 0;
            stream.on("data", (part) => {
              bytes += part.length;
              total += part.length;
              if (bytes > 4_000_000 || total > 10_000_000) {
                stream.destroy();
                finish(
                  new HttpError(400, "Excel archive exceeds allowed size"),
                );
              }
            });
            stream.on("error", () =>
              finish(new HttpError(400, "Invalid compressed entry size")),
            );
            stream.on("end", () => {
              if (!settled) zip.readEntry();
            });
          });
        });
        zip.readEntry();
      },
    );
  });
}
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
