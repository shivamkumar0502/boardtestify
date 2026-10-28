// OCR runs on the staff device. Images are not sent to a paid service.
export async function readPrintedPhoto(file, language, onProgress, signal) {
  if (
    !file ||
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 5000000
  )
    throw new Error("Choose a JPEG, PNG or WebP photo smaller than 5 MB.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 24000000) {
    bitmap.close();
    throw new Error("Crop the photo to one question column before extracting.");
  }
  const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const { createWorker } = await import("tesseract.js");
  let worker,
    ended = false,
    timer,
    abort;
  const operation = (async () => {
    worker = await createWorker(language === "hi" ? "hin+eng" : "eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      logger: (m) =>
        !ended && onProgress(Math.round((m.progress || 0) * 100), m.status),
    });
    if (ended || signal?.aborted) {
      await worker.terminate();
      throw new Error("Photo reading cancelled.");
    }
    await worker.setParameters({ preserve_interword_spaces: "1" });
    const { data } = await worker.recognize(canvas);
    if (!data.text?.trim())
      throw new Error(
        "No readable text found. Crop a clear printed question and try again.",
      );
    if (data.text.length > 20000)
      throw new Error(
        "Too much text. Crop the photo to at most ten questions.",
      );
    return { text: data.text.trim(), confidence: data.confidence };
  })();
  const stopped = new Promise((_, reject) => {
    abort = () => reject(new Error("Photo reading cancelled."));
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    timer = setTimeout(
      () =>
        reject(
          new Error("Photo reading timed out. Crop a smaller area and retry."),
        ),
      90000,
    );
  });
  try {
    return await Promise.race([operation, stopped]);
  } finally {
    ended = true;
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    if (worker) await worker.terminate();
  }
}
