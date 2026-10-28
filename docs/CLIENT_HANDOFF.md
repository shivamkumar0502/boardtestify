# Client handoff

## What the source now includes

Separate frontend/backend/app projects; Hindi/English UI; visual authoring; question/rubric/source approval; subject/session pattern management; private handwritten answer photos/PDF pages and optional OCR/vision; manual evaluation; targeted practice retry and instant objective feedback; announcements; phone linking/OTP sign-in; configurable plans, recurring billing/cancellation/refunds; bounded API/database/worker operations; migrations, synthetic load tests and a teacher-calibration runner.

The platform is a preparation tool, not an official BSEB grading service. Handwritten and diagram marks remain provisional until teacher approval. Never describe local tests as a guarantee of hosting capacity or evaluation accuracy.

## Academic team actions

The official references checked on 26 October 2026 are:

- [2026 Matric catalog](https://biharboardonline.com/modelpapermatric.html)
- [2026 Intermediate catalog](https://biharboardonline.com/modelpaperinter.html)
- [Matric Mathematics](https://biharboardonline.com/files/MatricModelPaper/2026/110_Math.pdf)
- [Matric Science](https://biharboardonline.com/files/MatricModelPaper/2026/112_Science.pdf)
- [Intermediate Physics](https://biharboardonline.com/files/InterModelPaper/2026/117_Physics.pdf)
- [Intermediate Accountancy](https://biharboardonline.com/files/InterModelPaper/2026/220_Accountancy.pdf)
- [Intermediate History](https://biharboardonline.com/files/InterModelPaper/2026/321_History.pdf)

The seed stores links, subject metadata and five pattern drafts for the 2025–26 examination session. Those sources do not establish the 2026–27 syllabus or 2027 examination rules. The Science paper's header count conflicts with its detailed section instructions; its draft follows the detailed instructions and requires teacher checking. No official question text, unverifiable PYQ keys, invented chapter lists or automatic current-session approval is seeded.

Teachers/content staff must add the applicable session's chapters/topics and owned/licensed/verified questions, references, diagram requirements and rubrics. Another administrator verifies academic sources/patterns and approves questions. Create a board mock by choosing the approved pattern and enough published questions for each section; mismatched duration/counts/marks/types are rejected.

## Calibration runner

Use a teacher-labelled JSON array, with each case containing:

- `id`: a non-identifying case label.
- `question`: a full valid question object (including academic metadata, source, reference, marks and criterion rubric).
- `answer`: the student's typed answer, with unnecessary personal information removed.
- `expectedMarks`: teacher-awarded marks from the same rubric.

Run `npm run calibrate -- /absolute/path/cases.json` after configuring the AI provider. The report includes scored/failed cases, mean absolute error, review rate, language/subject identifiers and case-level discrepancies. Teacher marks are not sent to the model. The runner reports `automaticReleaseApproved: false` even when numerical errors are small. At least 40 cases spanning both languages is only an initial sampling signal; use adequate subject/score-band coverage and independent teacher judgement. The runner does not calibrate handwriting automatically, and live image-based marks still require manual approval.

## Client-owned activation

Configure production MongoDB, HTTPS host/domain, actual AI/vision/OCR model credentials, private storage, SMTP, optional Twilio Verify and optional Razorpay plans/webhooks. Run migrations before production startup. Review retention and backup/restore requirements. Test actual sandbox and live-provider flows with authorized client accounts; local adapters were contract-tested with simulated responses only.

Build/sign the Android release with the client's signing identity and complete physical-device/store acceptance. The exported JS bundle is not an AAB release. Complete a staging soak and workload test on the intended hosting/database plan before promising a concurrent-student capacity.

## Suggested acceptance scenarios

A student signs up in Hindi, selects the right class/stream, starts a source-approved test, refreshes/reconnects, saves an answer photo before timeout, sees provisional feedback and then an evaluator-approved result. A reviewer cannot approve their own question changes. A renewed payment grants only the paid plan scope; repeat webhooks do not extend it, and full refunds revoke that grant. A database/provider outage returns a controlled unavailable/review state; recovery does not erase submitted answers.

## Added release tooling

Administration → Operations and `npm run preflight` list missing service configuration without displaying credentials or certifying provider acceptance. Web/Android now accept bounded PDF answer pages; Android can request a secure email reset link, completed on the HTTPS website. Password reset invalidates prior links and sessions, including concurrent stale reset attempts; legacy reset links must be requested again after this update.

See OPERATIONS.md for the Linux Docker API/worker setup, PDF host requirements, checksummed database backups and restore drills into a new isolated database. The local recovery test uses real MongoDB tools with disposable data; it does not constitute a production recovery drill.

## BSEB source-based practice pack

Five bilingual mini-test drafts / fifteen adapted MCQs can be inserted with `npm run seed:bseb` after migrations. Full official paper links and per-question source pages are retained. Teachers must check the suggested keys and approve questions before publishing the tests. The historical 2025–26 scope is preserved. See BSEB_TEST_PACK.md. This is not a complete official question bank or current-session release approval.
