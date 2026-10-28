import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
// Pin versions in package-lock; serve models and WASM from our own origin.
export function prepareOCRAssets() {
  const target = fileURLToPath(new URL("./public/ocr/", import.meta.url));
  const root = (name) => dirname(require.resolve(`${name}/package.json`));
  mkdirSync(join(target, "core"), { recursive: true });
  copyFileSync(
    fileURLToPath(new URL("./OCR_THIRD_PARTY.md", import.meta.url)),
    join(target, "THIRD_PARTY.md"),
  );
  mkdirSync(join(target, "lang"), { recursive: true });
  copyFileSync(
    join(root("tesseract.js"), "dist/worker.min.js"),
    join(target, "worker.min.js"),
  );
  for (const file of readdirSync(root("tesseract.js-core")))
    if (/\.wasm(?:\.js)?$/.test(file))
      copyFileSync(
        join(root("tesseract.js-core"), file),
        join(target, "core", file),
      );
  for (const lang of ["eng", "hin"])
    copyFileSync(
      join(
        root(`@tesseract.js-data/${lang}`),
        `4.0.0_best_int/${lang}.traineddata.gz`,
      ),
      join(target, `lang/${lang}.traineddata.gz`),
    );
  copyFileSync(
    join(root("tesseract.js"), "LICENSE.md"),
    join(target, "LICENSE-tesseract.txt"),
  );
  copyFileSync(
    join(root("tesseract.js-core"), "LICENSE"),
    join(target, "LICENSE-core.txt"),
  );
}
