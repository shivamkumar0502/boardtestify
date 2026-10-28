import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { answerPDF } from "./fixtures/pdf.js";
import { integrationReadiness } from "../backend/src/readiness.js";
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/pdf_test";
process.env.WEB_ORIGIN = "http://localhost:5173";
process.env.JWT_SECRET = "pdf-test-secret-".repeat(5);
const { renderAnswerPDF, pdfAvailable } = await import("../backend/src/pdf.js");
test("PDF pages render in order to bounded JPEGs; originals are not returned", async () => {
  assert.equal(
    await pdfAvailable(),
    true,
    "Install Poppler (and util-linux on Linux) to run PDF checks",
  );
  const pages = await renderAnswerPDF(answerPDF());
  assert.equal(pages.length, 2);
  assert.notDeepEqual(pages[0], pages[1]);
  for (const bytes of pages) {
    const image = await sharp(bytes).metadata();
    assert.equal(image.format, "jpeg");
    assert.ok(image.width <= 2400 && image.height <= 2400);
  }
});
test("malformed, oversized and over-capacity PDFs fail without partial page acceptance", async () => {
  await assert.rejects(renderAnswerPDF(Buffer.from("fake.pdf")), {
    status: 400,
  });
  await assert.rejects(renderAnswerPDF(Buffer.alloc(10_000_001)), {
    status: 413,
  });
  await assert.rejects(renderAnswerPDF(answerPDF(5)), { status: 400 });
  await assert.rejects(renderAnswerPDF(answerPDF(2), 1), { status: 400 });
  await assert.rejects(renderAnswerPDF(Buffer.from("%PDF-1.4\nbroken\n")), {
    status: 400,
  });
});
test("release diagnostics distinguish missing/partial config and never return values or approval", () => {
  const config = {
    S3_BUCKET: "private-sensitive-bucket",
    AI_API_KEY: "secret-key",
    AI_MODEL: "secret-model",
  };
  const report = integrationReadiness(config, true);
  assert.equal(
    report.integrations.find((i) => i.id === "storage").status,
    "PARTIAL",
  );
  assert.equal(
    report.integrations.find((i) => i.id === "ai").status,
    "CONFIGURED",
  );
  assert.equal(
    report.integrations.find((i) => i.id === "payments").status,
    "MISSING",
  );
  assert.equal(report.automaticReleaseApproved, false);
  assert.ok(report.integrations.every((i) => !i.verified));
  assert.ok(!JSON.stringify(report).includes("secret-key"));
  assert.ok(!JSON.stringify(report).includes("private-sensitive-bucket"));
});
