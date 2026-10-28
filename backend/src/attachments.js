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
export const attachments = Router();
attachments.use(auth);
const imageGate = concurrencyGate(2);
sharp.concurrency(1);
sharp.cache({ memory: 16, files: 0, items: 20 });
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
  upload,
  async (req, res) => {
    const attemptId = id.parse(req.params.id),
      questionId = id.parse(req.body.questionId);
    const a = await Attempt.findOne({
      _id: attemptId,
      userId: String(req.user._id),
      status: "ACTIVE",
    }).select("questions deadline");
    assert(
      a && (!a.deadline || a.deadline > new Date()),
      409,
      "Attempt is finalized or expired",
    );
    assert(
      a.questions.some((q) => q._id === questionId && isDescriptive(q.type)),
      400,
      "Attach sheets to a descriptive question",
    );
    assert(req.file, 400, "Choose an answer-sheet image");
    assert(
      (await Attachment.countDocuments({
        attemptId,
        questionId,
        ownerId: String(req.user._id),
      })) < 8,
      400,
      "Maximum eight uploads per question; attach up to four pages",
    );
    const bytes = await normalizeImage(req.file.buffer);
    const key = `answer-sheets/${randomToken()}.jpeg`;
    await putImage(key, bytes);
    try {
      const row = await Attachment.create({
        ownerId: String(req.user._id),
        attemptId,
        questionId,
        key,
        mime: "image/jpeg",
        size: bytes.length,
        checksum: createHash("sha256").update(bytes).digest("hex"),
        status: "READY",
        deleteAfter: new Date(
          Date.now() + env.ATTACHMENT_RETENTION_DAYS * 86400000,
        ),
      });
      res
        .status(201)
        .json({ id: String(row._id), mime: row.mime, size: row.size });
    } catch (e) {
      await deleteImage(key).catch(() => {});
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
