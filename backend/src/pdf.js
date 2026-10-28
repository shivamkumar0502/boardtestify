import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assert, HttpError } from "./lib.js";
const run = promisify(execFile);
const options = {
  timeout: 8000,
  killSignal: "SIGKILL",
  maxBuffer: 5_000_000,
  encoding: "buffer",
  windowsHide: true,
  // PDF tools do not need database/provider credentials.
  env: { PATH: process.env.PATH, LC_ALL: "C", LANG: "C" },
};
const limitedRun = (command, args) =>
  process.platform === "linux"
    ? run(
        "prlimit",
        ["--as=536870912", "--cpu=8", "--nofile=64", "--", command, ...args],
        options,
      )
    : run(command, args, options);
let available;
export function pdfAvailable() {
  return (available ??= Promise.all([
    limitedRun("pdfinfo", ["-v"]),
    limitedRun("pdftoppm", ["-v"]),
  ]).then(
    () => true,
    () => false,
  ));
}
export async function renderAnswerPDF(buffer, maxPages = 4) {
  assert(
    buffer?.length && buffer.length <= 10_000_000,
    413,
    "PDF must be smaller than 10 MB",
  );
  assert(
    buffer.subarray(0, 5).toString("ascii") === "%PDF-",
    400,
    "Upload a valid PDF",
  );
  assert(
    Number.isInteger(maxPages) && maxPages >= 1 && maxPages <= 4,
    400,
    "Attach a maximum of four pages per answer",
  );
  assert(
    await pdfAvailable(),
    503,
    "PDF processing is unavailable. Upload page photos instead.",
  );
  const dir = await mkdtemp(join(tmpdir(), "bt-answer-"));
  try {
    const file = join(dir, "answer.pdf");
    await writeFile(file, buffer, { mode: 0o600 });
    const { stdout } = await limitedRun("pdfinfo", [file]);
    const info = stdout.toString("utf8");
    assert(
      !/^Encrypted:\s+yes/im.test(info),
      400,
      "Password-protected PDFs are not supported. Upload page photos instead.",
    );
    const count = Number(/^Pages:\s+(\d+)\s*$/im.exec(info)?.[1]);
    assert(
      Number.isInteger(count) && count > 0 && count <= maxPages,
      400,
      `PDF exceeds the ${maxPages} remaining page slot(s). Split the file or remove attached pages.`,
    );
    const pages = [];
    // Sequential rendering bounds CPU and memory, independent of source dimensions.
    for (let page = 1; page <= count; page++) {
      const { stdout: bytes } = await limitedRun("pdftoppm", [
        "-f",
        String(page),
        "-l",
        String(page),
        "-singlefile",
        "-scale-to",
        "2400",
        "-jpeg",
        "-jpegopt",
        "quality=85",
        file,
      ]);
      assert(bytes.length > 0, 400, "PDF contains an unreadable page");
      pages.push(bytes);
    }
    return pages;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (error.code === "ENOENT")
      throw new HttpError(
        503,
        "PDF processing is unavailable. Upload page photos instead.",
      );
    throw new HttpError(
      400,
      "PDF is invalid or too complex to process. Upload page photos instead.",
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
