import { env } from "./config.js";
import { Attachment } from "./models.js";
import { readImage } from "./storage.js";
import { assert } from "./lib.js";
import { boundedJSON } from "./reliability.js";
export async function extractHandwriting(bytes) {
  assert(env.OCR_API_KEY, 503, "Handwriting OCR provider is not configured");
  const response = await fetch(
    `https://vision.googleapis.com/v1/images:annotate?key=${encodeURIComponent(env.OCR_API_KEY)}`,
    {
      method: "POST",
      signal: AbortSignal.timeout(25000),
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: [
          {
            image: { content: bytes.toString("base64") },
            features: [{ type: "DOCUMENT_TEXT_DETECTION" }],
            imageContext: { languageHints: ["hi", "en"] },
          },
        ],
      }),
    },
  );
  assert(response.ok, 503, "Handwriting OCR provider is unavailable");
  const body = await boundedJSON(response);
  const result = body.responses?.[0];
  assert(result && !result.error, 502, "OCR could not process this page");
  const full = result.fullTextAnnotation;
  assert(full?.text?.trim(), 422, "No readable handwriting found");
  const words = (full.pages || []).flatMap((p) =>
    (p.blocks || []).flatMap((b) =>
      (b.paragraphs || []).flatMap((p) => p.words || []),
    ),
  );
  const confidences = words
    .map((w) => w.confidence)
    .filter((x) => typeof x === "number");
  return {
    text: full.text.slice(0, 20000),
    confidence: confidences.length
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length
      : 0,
  };
}
export async function attachmentEvidence(ids, attempt) {
  const images = [],
    texts = [],
    confidences = [];
  for (const assetId of ids) {
    const asset = await Attachment.findOne({
      _id: assetId,
      attemptId: String(attempt._id),
      ownerId: attempt.userId,
    }).lean();
    assert(asset, 422, "An answer-sheet page is unavailable");
    const bytes = await readImage(asset.key);
    images.push(`data:image/jpeg;base64,${bytes.toString("base64")}`);
    if (asset.status === "OCR_COMPLETE") {
      texts.push(asset.text);
      confidences.push(asset.confidence);
    } else {
      try {
        const result = await extractHandwriting(bytes);
        await Attachment.updateOne(
          { _id: asset._id },
          { $set: { ...result, status: "OCR_COMPLETE" } },
        );
        texts.push(result.text);
        confidences.push(result.confidence);
      } catch (e) {
        await Attachment.updateOne(
          { _id: asset._id },
          { $set: { status: "OCR_REVIEW", error: e.message } },
        );
        texts.push("[Unreadable page: manual review required]");
        confidences.push(0);
      }
    }
  }
  return {
    images,
    text: texts.join("\n\n--- PAGE ---\n\n"),
    confidence: Math.min(...confidences, 1),
  };
}
