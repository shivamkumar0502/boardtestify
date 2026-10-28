import { fullPhoto, uprightPhoto, selectedPhoto } from "./ocr-image";
// OCR runs on the staff device. Images are not sent to a paid service.
export async function readPrintedPhoto(
  file,
  language,
  onProgress,
  signal,
  options = {},
) {
  if (
    !file ||
    !/^image\/(jpeg|png|webp)$/.test(file.type) ||
    file.size > 5000000
  )
    throw new Error("Choose a JPEG, PNG or WebP photo smaller than 5 MB.");
  if (signal?.aborted) throw new Error("Photo reading cancelled.");
  onProgress?.(0, "Preparing selected photo");
  const canvas = selectedPhoto(
    await uprightPhoto(file, options.rotation || 0),
    options.crop || fullPhoto,
  );
  if (signal?.aborted) throw new Error("Photo reading cancelled.");
  const { createWorker } = await import("tesseract.js");
  let worker,
    ended = false,
    timer,
    abort,
    rejectWorker;
  const workerFailed = new Promise((_, reject) => {
    rejectWorker = reject;
  });
  const operation = (async () => {
    worker = await createWorker(language === "hi" ? "hin+eng" : "eng", 1, {
      workerPath: "/ocr/worker.min.js",
      corePath: "/ocr/core",
      langPath: "/ocr/lang",
      workerBlobURL: false,
      errorHandler: () =>
        rejectWorker(
          new Error(
            "Photo reader could not load or process this image. Check your connection, reload and retry a smaller crop.",
          ),
        ),
      logger: (m) =>
        !ended && onProgress?.(Math.round((m.progress || 0) * 100), m.status),
    });
    if (ended || signal?.aborted) {
      await worker.terminate();
      throw new Error("Photo reading cancelled.");
    }
    await worker.setParameters({
      preserve_interword_spaces: "1",
      tessedit_pageseg_mode: "6",
      user_defined_dpi: "300",
    });
    const { data } = await worker.recognize(canvas, { rotateAuto: true });
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
    return await Promise.race([operation, stopped, workerFailed]);
  } catch (e) {
    throw e instanceof Error
      ? e
      : new Error(
          "Photo reader failed. Reload and retry a smaller, upright crop.",
        );
  } finally {
    ended = true;
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
    if (worker) await worker.terminate().catch(() => {});
  }
}
