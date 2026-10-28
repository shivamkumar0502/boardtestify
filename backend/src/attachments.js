import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { id, isDescriptive } from "@boardtestify/domain";
import { auth, assert, randomToken } from "./lib.js";
import { Attempt, Attachment } from "./models.js";
import { putImage, deleteImage, imageURL } from "./storage.js";
import { concurrencyGate, sharedLimit } from "./reliability.js";
import { env } from "./config.js";
import { renderAnswerPDF } from "./pdf.js";
export const attachments = Router();
attachments.use(auth);
const imageGate = concurrencyGate(2);
sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 20 });
const sheetUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10_000_000, files: 1, fields: 2, parts: 3 },
}).single("file");
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5_000_000, files: 1, fields: 2, parts: 3 },
}).single("file");
export async function normalizeImage(buffer) {
  assert(
    buffer?.length && buffer.length <= 5_000_000,
    413,
    "Image must be smaller than 5 MB",
  );
  try {
    const image = sharp(buffer, {
      limitInputPixels: 12_000_000,
      failOn: "error",
      animated: false,
    });
    const metadata = await image.metadata();
    assert(
      ["jpeg", "png", "webp"].includes(metadata.format),
      400,
      "Upload a JPEG, PNG or WebP image",
    );
    const bytes = await image
      .rotate()
      .resize({
        width: 2400,
        height: 3200,
        fit: "inside",
        withoutEnlargement: true,
      })
      .flatten({ background: "#fff" })
      .jpeg({ quality: 85 })
      .toBuffer();
    assert(
      bytes.length <= 5_000_000,
      413,
      "Processed image exceeds size limit",
    );
    return bytes;
  } catch (e) {
    if (e.status) throw e;
    assert(false, 400, "Invalid or oversized image");
  }
}
attachments.post(
  "/attempts/:id/sheets",
  sharedLimit({
    name: "answer-upload",
    limit: 20,
    windowMs: 60000,
    key: (req) => String(req.user._id),
  }),
  imageGate,
  sheetUpload,
  async (req, res) => {
    const attemptId = id.parse(req.params.id),
      questionId = id.parse(req.body.questionId),
      ownerId = String(req.user._id);
    const active = () => ({
      _id: attemptId,
      userId: ownerId,
      status: "ACTIVE",
      $and: [
        { $or: [{ deadline: null }, { deadline: { $gt: new Date() } }] },
        { $or: [{ readUntil: null }, { readUntil: { $lte: new Date() } }] },
      ],
    });
    const a = await Attempt.findOne(active()).select("questions");
    assert(a, 409, "Attempt is finalized, expired or in its reading period");
    assert(
      a.questions.some((q) => q._id === questionId && isDescriptive(q.type)),
      400,
      "Attach sheets to a descriptive question",
    );
    assert(req.file, 400, "Choose an answer-sheet photo or PDF");
    const isPDF = req.file.buffer.subarray(0, 5).toString("ascii") === "%PDF-";
    const maxPages = Number(req.body.maxPages ?? 4);
    assert(
      Number.isInteger(maxPages) && maxPages >= 1 && maxPages <= 4,
      400,
      "Attach a maximum of four pages per answer",
    );
    const sourcePages = isPDF
      ? await renderAnswerPDF(req.file.buffer, maxPages)
      : [req.file.buffer];
    const pages = [];
    for (const bytes of sourcePages) pages.push(await normalizeImage(bytes));
    const scope = { attemptId, questionId, ownerId };
    // Initialize legacy attempts once, then atomically reserve upload capacity.
    const counter = `uploadCounts.${questionId}`;
    const existing = await Attachment.countDocuments(scope);
    await Attempt.updateOne(
      { ...active(), [counter]: { $exists: false } },
      { $set: { [counter]: existing } },
    );
    const reserved = await Attempt.updateOne(
      { ...active(), [counter]: { $lte: 8 - pages.length } },
      { $inc: { [counter]: pages.length } },
    );
    assert(
      reserved.matchedCount,
      409,
      "Upload limit reached or attempt expired. Maximum eight uploaded pages per question.",
    );
    const keys = [],
      rows = [];
    try {
      for (const bytes of pages) {
        const key = `answer-sheets/${randomToken()}.jpeg`;
        keys.push(key);
        await putImage(key, bytes);
        const row = await Attachment.create({
          ...scope,
          key,
          mime: "image/jpeg",
          size: bytes.length,
          checksum: createHash("sha256").update(bytes).digest("hex"),
          status: "READY",
          deleteAfter: new Date(
            Date.now() + env.ATTACHMENT_RETENTION_DAYS * 86400000,
          ),
        });
        rows.push(row);
      }
      assert(
        await Attempt.exists(active()),
        409,
        "Attempt finalized or expired during upload. Pages were not attached.",
      );
      const results = rows.map((row) => ({
        id: String(row._id),
        mime: row.mime,
        size: row.size,
      }));
      // Keep the original one-photo response compatible with older clients.
      res.status(201).json(isPDF ? { pages: results } : results[0]);
    } catch (e) {
      await Promise.allSettled(
        keys.map(async (key) => {
          await deleteImage(key);
          await Attachment.deleteOne({ key, ...scope });
        }),
      );
      await Attempt.updateOne(
        { _id: attemptId },
        { $inc: { [counter]: -pages.length } },
      );
      throw e;
    }
  },
);

attachments.post(
  "/admin/question-image",
  (req, res, next) => {
    assert(
      ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"].includes(req.user.role),
      403,
      "Insufficient permission",
    );
    next();
  },
  imageGate,
  upload,
  async (req, res) => {
    assert(
      ["CONTENT_EDITOR", "ADMIN", "SUPER_ADMIN"].includes(req.user.role),
      403,
      "Insufficient permission",
    );
    assert(req.file, 400, "Choose an image");
    const bytes = await normalizeImage(req.file.buffer);
    const key = `question-images/${randomToken()}.jpeg`;
    await putImage(key, bytes);
    res.status(201).json({ key, url: await imageURL(key) });
  },
);
attachments.get("/attachments/:id", async (req, res) => {
  const a = await Attachment.findById(id.parse(req.params.id)).lean();
  assert(
    a &&
      (a.ownerId === String(req.user._id) ||
        ["EVALUATOR", "ADMIN", "SUPER_ADMIN"].includes(req.user.role)),
    404,
    "Attachment not found",
  );
  res.json({
    id: String(a._id),
    url: await imageURL(a.key),
    status: a.status,
    text: a.text,
    confidence: a.confidence,
  });
});
export async function cleanupAttachments() {
  const rows = await Attachment.find({ deleteAfter: { $lte: new Date() } })
    .limit(100)
    .lean();
  for (let offset = 0; offset < rows.length; offset += 5) {
    const results = await Promise.allSettled(
      rows.slice(offset, offset + 5).map(async (row) => {
        await deleteImage(row.key);
        await Attachment.deleteOne({ _id: row._id });
      }),
    );
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw failed.reason;
  }
}
