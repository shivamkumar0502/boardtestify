# Simple test series and question import

## Student website

The test library now opens with subject/session series cards, showing actual published test counts and free counts. A series contains mode tabs, search, configured chapter filters, free/premium filtering and test rows with question counts/duration, start/resume and result links. Premium tests link to the existing study-pass page when no entitlement is available. Entitlement and examination timing still remain server-authoritative.

Series are derived from active academic subjects with published tests; there is no fabricated enrollment count or copied Testbook branding/content. Drafts never appear. Class 10 and the student's selected Class 12 stream remain isolated. Historical sessions stay labelled. Only the website library changes here; the native app continues to use the existing flat student-test API.

`GET /api/test-series` returns up to 100 scoped published subject groups. `GET /api/test-series/:subjectId/tests` uses an opaque ObjectId cursor with a 20-test page, bounded literal search, optional mode/chapter/access filters and no answer keys/question IDs. Per-test resume/result state is read from that student's attempts. Composite indexes, a twenty-request series gate and five-second query deadlines bound discovery work. This reduces resource spikes; it is not a certified concurrent-student capacity. Native `/api/tests` remains compatible.

## Staff shortcut

Open **Administration → Create test from photo or text** (or the Add questions tab).

1. Select the academic session, class, stream and subject. Enter the book/source name and question language.
2. Choose **Book photo**, **Paste questions**, or the existing **CSV / Excel** import.
3. For photos, use JPEG/PNG/WebP up to 5 MB and crop to at most ten questions. Source images are validated, metadata stripped and re-encoded before private storage.
4. For pasted MCQs, use the template below. This format works without an AI key. Missing answer keys remain empty; they must be filled during review.
5. Open the processed import, compare against the source, edit every question/options/key/marks/reference/rubric as needed, set the test title/duration and save a draft test. No JSON is required in this path.
6. A different administrator must review/publish the questions, then publish the test using the existing content workflow. The importer never creates published content or official/PYQ labels.

```text
1. Your question text
A) First option
B) Second option
C) Third option
D) Fourth option
Answer: B
```

At most ten questions are accepted per job; oversized/unsupported formats are rejected or returned for correction rather than silently dropping pages/questions. For irregular text, AI extraction is used only when configured. Without AI, text needing correction stays available in the preview for copying back into the template. Manual question creation and validated CSV/Excel imports remain available.

Photo processing requires private S3-compatible storage plus either Google Vision OCR (`OCR_API_KEY`) or image-capable AI (`AI_API_KEY`, `AI_MODEL`, `AI_VISION_ENABLED=true`). OCR followed by AI can handle irregular layouts; vision AI can inspect the original image directly. Missing configuration shows an actionable message and preserves the form. Unknown answers are not invented automatically. Any generated descriptive references/rubrics are suggestions requiring review. Diagrams need a separately cropped question image uploaded through the question editor before saving; the source book photo is never automatically published as a question image.

The recent-import list allows staff to reopen jobs after leaving the page. Source photos use short-lived signed URLs and are retained with their import jobs for seven days; save needed question images separately. Content editors can read/edit their own jobs. ADMIN/SUPER_ADMIN can read other staff imports to review evidence, but cannot commit/retry someone else's job. Imported question rows provide **View import source**. Saved question/test records survive source cleanup.

## Durable processing and deployment

Run migrations before starting updated production processes:

```bash
npm run migrate
npm run dev
```

Development can use the existing in-process worker. In production, keep `RUN_WORKER=false` on API replicas and run `npm run worker` separately with the same MongoDB/storage/provider settings. Queued imports will not finish without a worker. The worker handles one authoring job per process alongside the existing bounded examination-evaluation pool.

`AuthoringJob` persists source metadata, results and status in MongoDB. A unique partial slot index limits each owner to three pending/processing jobs across replicas. Staff upload concurrency is two per API process with a per-user rate limit. Claims are atomic, have two-minute leases, twenty-second heartbeats and token-fenced completion. Interrupted work is reclaimable, with at most three processing claims. Failed jobs keep their source for retry/manual correction; invalid AI output never becomes published questions or student marks. Garbage cleanup deletes expired source objects and jobs in bounded batches.

Saving freezes the first reviewed payload before batched writes. Question/test identities are deterministic per job, so retrying a partial save cannot duplicate records or mix two edit versions. Independent question approval still applies. An idempotent audit event records the saved draft. A failed save can be reopened to finish the frozen version.

## API

All `/admin/question-imports` routes require CONTENT_EDITOR/ADMIN/SUPER_ADMIN authorization:

- `POST /text`: academic scope, language, sourceTitle, text → 202 + job ID.
- `POST /photo`: multipart `file` + JSON `meta` (academic, language, sourceTitle) → 202 + job ID.
- `GET /`: the owner's latest twenty imports.
- `GET /:id`: status, editable candidates, warnings, preserved source text and signed source URL; privileged reviewers can read another staff member's evidence.
- `POST /:id/retry`: owner-only retry of a failed job within the attempt/queue limits.
- `POST /:id/commit`: reviewed questions, title and durationMinutes → draft question/test records. A repeated save returns the same draft test.

Malformed inputs, wrong owners/roles, missing keys, unsupported images, stale leases and failed providers have explicit error/review states. Actual OCR accuracy on the client's books, paid-provider acceptance, physical Android testing and production/staging workload tests remain separate acceptance work. Local tests use controlled provider adapters and disposable storage/database fixtures; no live paid requests or client database writes were performed.

For local networks where the IPv4 MongoDB ping succeeds, set `DB_IP_FAMILY=4` in the root `.env` rather than editing `models.js`. The default remains automatic; values 4 and 6 are supported. Keep the existing timeout configuration for slow Atlas connections.
