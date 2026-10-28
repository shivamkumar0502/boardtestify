import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import {
  id,
  academicSchema,
  questionSchema,
  testSchema,
} from "@boardtestify/domain";
import { auth, allow, assert, hash, randomToken } from "./lib.js";
import { AuthoringJob, QuestionModel, TestModel, Audit } from "./models.js";
import { validateAcademic } from "./content.js";
import { normalizeImage } from "./attachments.js";
import { putImage, deleteImage, imageURL, storageEnabled } from "./storage.js";
import { concurrencyGate, sharedLimit } from "./reliability.js";
import { env } from "./config.js";
export const authoring = Router();
authoring.use(
  "/admin/question-imports",
  auth,
  allow("CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"),
);
const gate = concurrencyGate(2),
  upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5000000, files: 1, fields: 1, parts: 2 },
  }).single("file");
const metadata = z.object({
  academic: academicSchema,
  language: z.enum(["hi", "en"]),
  sourceTitle: z.string().trim().min(2).max(300),
});
const limit = sharedLimit({
  name: "question-import",
  limit: 15,
  windowMs: 60000,
  key: (req) => String(req.user._id),
});
const own = (req) => ({ ownerId: String(req.user._id) });
async function findJob(req, readOnly = false) {
  const job = await AuthoringJob.findOne({
    _id: id.parse(req.params.id),
    ...(readOnly && ["ADMIN", "SUPER_ADMIN"].includes(req.user.role)
      ? {}
      : own(req)),
  }).lean();
  assert(job, 404, "Question import not found");
  return job;
}
async function enqueue(req, input, method) {
  for (let slot = 0; slot < 3; slot++)
    try {
      return await AuthoringJob.create({
        ownerId: String(req.user._id),
        slot,
        status: "PENDING",
        method,
        input: { ...input, method },
        deleteAfter: new Date(Date.now() + 7 * 86400000),
      });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  assert(
    false,
    429,
    "Three imports are already processing. Wait for one to finish.",
  );
}
authoring.get("/admin/question-imports", async (req, res) =>
  res.json(
    await AuthoringJob.find(own(req))
      .sort({ createdAt: -1 })
      .limit(20)
      .select("status method input.sourceTitle createdAt savedTestId error")
      .lean(),
  ),
);
authoring.get("/admin/question-imports/:id", async (req, res) => {
  const job = await findJob(req, true);
  res.json({
    canEdit: job.ownerId === String(req.user._id),
    id: String(job._id),
    status: job.status,
    method: job.method,
    input: {
      academic: job.input.academic,
      language: job.input.language,
      sourceTitle: job.input.sourceTitle,
      text: job.input.text,
    },
    result: job.result,
    error: job.error,
    savedTestId: job.savedTestId,
    commitPending: !!job.commitInput,
    reviewed: job.commitInput
      ? {
          questions: job.commitInput.questions,
          title: job.commitInput.title,
          durationMinutes: job.commitInput.durationMinutes,
        }
      : null,
    sourceURL: job.input.sourceKey
      ? await imageURL(job.input.sourceKey).catch(() => null)
      : null,
  });
});
authoring.post(
  "/admin/question-imports/text",
  limit,
  gate,
  async (req, res) => {
    const input = metadata
      .extend({ text: z.string().trim().min(1).max(20000) })
      .parse(req.body);
    await validateAcademic(input.academic);
    const job = await enqueue(req, input, "TEXT");
    res.status(202).json({ id: String(job._id), status: job.status });
  },
);
authoring.post(
  "/admin/question-imports/photo",
  limit,
  gate,
  upload,
  async (req, res) => {
    let raw;
    try {
      raw = JSON.parse(req.body.meta || "");
    } catch {
      assert(false, 400, "Choose class and subject before uploading");
    }
    const input = metadata.parse(raw);
    await validateAcademic(input.academic);
    assert(req.file, 400, "Choose a photo");
    assert(
      storageEnabled(),
      503,
      "Photo import needs private storage. You can use pasted text instead.",
    );
    assert(
      env.OCR_API_KEY ||
        (env.AI_API_KEY && env.AI_MODEL && env.AI_VISION_ENABLED === "true"),
      503,
      "Photo extraction is not configured. You can use pasted text instead.",
    );
    const bytes = await normalizeImage(req.file.buffer),
      key = `question-imports/${randomToken()}.jpeg`;
    await putImage(key, bytes);
    try {
      const job = await enqueue(req, { ...input, sourceKey: key }, "PHOTO");
      res.status(202).json({ id: String(job._id), status: job.status });
    } catch (e) {
      await deleteImage(key).catch(() => {});
      throw e;
    }
  },
);
authoring.post("/admin/question-imports/:id/retry", limit, async (req, res) => {
  const job = await findJob(req);
  assert(
    job.status === "FAILED" && job.attempts < 3,
    409,
    "This import cannot be retried; create a new import.",
  );
  for (let slot = 0; slot < 3; slot++)
    try {
      const changed = await AuthoringJob.updateOne(
        { _id: job._id, ...own(req), status: "FAILED", attempts: { $lt: 3 } },
        { $set: { status: "PENDING", slot, error: null } },
      );
      assert(changed.matchedCount, 409, "Import state changed. Reload it.");
      return res.json({ id: String(job._id), status: "PENDING" });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  assert(
    false,
    429,
    "Three imports are already processing. Wait for one to finish.",
  );
});
authoring.post(
  "/admin/question-imports/:id/commit",
  limit,
  async (req, res) => {
    let job = await findJob(req);
    if (job.status === "SAVED")
      return res.json({ testId: job.savedTestId, status: "DRAFT" });
    assert(job.status === "READY", 409, "Wait for extraction before saving");
    if (!job.commitInput) {
      const d = z
        .object({
          title: z.string().trim().min(3).max(150),
          durationMinutes: z.number().int().min(1).max(180),
          questions: z.array(questionSchema).min(1).max(10),
        })
        .parse(req.body);
      await validateAcademic(job.input.academic);
      const questions = d.questions.map((q) => {
        assert(
          ["session", "classLevel", "stream", "subjectId", "chapterId"].every(
            (k) => q.academic[k] === job.input.academic[k],
          ),
          400,
          "Keep all questions in the selected subject and session",
        );
        assert(
          !q.requiresDiagram || q.imageKey,
          400,
          "Add a separate cropped question image for diagram questions before saving",
        );
        assert(
          !q.imageKey ||
            /^question-images\/[a-f0-9]{64}\.jpeg$/.test(q.imageKey),
          400,
          "Upload a cropped question image using the image field",
        );
        return questionSchema.parse({
          ...q,
          academic: job.input.academic,
          language: job.input.language,
          isPYQ: false,
          source: `${job.input.sourceTitle} · reviewed import draft; teacher approval required.`,
        });
      });
      // Freeze the first reviewed payload before writes so retries after a partial
      // database failure cannot mix two different edits or duplicate questions.
      await AuthoringJob.updateOne(
        {
          _id: job._id,
          ...own(req),
          status: "READY",
          commitInput: { $exists: false },
        },
        { $set: { commitInput: { ...d, questions } } },
      );
      job = await AuthoringJob.findById(job._id).lean();
    }
    assert(job.commitInput, 409, "Import changed. Reload before saving");
    const d = job.commitInput;
    const rows = d.questions.map((data, i) => ({
      _id: hash(`import-question:${job._id}:${i}`).slice(0, 24),
      hash: hash(`import-question:${job._id}:${i}`),
      data,
    }));
    await QuestionModel.bulkWrite(
      rows.map((row) => ({
        updateOne: {
          filter: { _id: row._id },
          update: {
            $setOnInsert: {
              ...row,
              originJobId: String(job._id),
              status: "DRAFT",
              version: 1,
              creator: String(req.user._id),
            },
          },
          upsert: true,
        },
      })),
      { ordered: true },
    );
    const testId = hash(`import-test:${job._id}`).slice(0, 24);
    const data = testSchema.parse({
      title: d.title,
      description: `Source: ${job.input.sourceTitle}. Extracted questions and answers require independent review.`,
      academic: job.input.academic,
      mode: "PRACTICE",
      durationMinutes: d.durationMinutes,
      sections: [
        {
          id: "imported",
          title: "Imported questions",
          questionIds: rows.map((q) => q._id),
          instructions:
            "Answer all questions. Draft marking requires teacher review.",
        },
      ],
    });
    await TestModel.updateOne(
      { _id: testId },
      {
        $setOnInsert: {
          data,
          status: "DRAFT",
          version: 1,
          creator: String(req.user._id),
        },
      },
      { upsert: true },
    );
    await Audit.updateOne(
      { _id: hash(`import-audit:${job._id}`).slice(0, 24) },
      {
        $setOnInsert: {
          actor: String(req.user._id),
          action: "QUESTION_IMPORT_SAVE",
          entityId: testId,
          details: { jobId: String(job._id), questions: rows.length },
        },
      },
      { upsert: true },
    );
    await AuthoringJob.updateOne(
      { _id: job._id, ...own(req) },
      { $set: { status: "SAVED", savedTestId: testId } },
    );
    res.json({ testId, status: "DRAFT", questions: rows.length });
  },
);
