# Validation evidence

Local checks on 28 October 2026. These results concern the repository source and disposable test fixtures, not an activated production deployment.

| Check                                                        | Result                                                |
| ------------------------------------------------------------ | ----------------------------------------------------- |
| JavaScript syntax and no TypeScript source (`npm run check`) | Pass                                                  |
| Domain/scoring/locale tests (`npm test`)                     | 25 passed                                             |
| MongoDB/API integration (`npm run test:integration`)         | 21 passed; optional backup-tools case skipped locally |
| React production build                                       | Pass                                                  |
| Expo Android JS/Hermes bundle export                         | Pass; not a signed APK/AAB                            |

Browser acceptance: 20 tests passed across desktop Chrome and Pixel 5 mobile-web emulation. They cover Hindi registration/dashboard/exam, visual question creation, blocked self-approval, second-reviewer publication, visual test creation, persisted/reloaded answers, submission/results and narrow-screen layout. The PDF flow includes a real two-page upload, ordered private previews, refresh with restored pages, and final submission. The staff configuration checklist is also exercised. Hindi fonts are bundled with the website, including offline exam use.

Integration coverage includes authorization, independent publication, source-backed pattern validation, private image validation, OCR/vision review fallback, one-use OTP challenges, captured one-time/recurring payments, cancellation/full refunds/replay, reading time, internal choices, concurrent answer conflicts, shared rate windows, overload gates, fenced evaluation lease recovery and database outage/reconnect without loss of saved answers. External paid providers use controlled adapter responses; no live charge/SMS or provider acceptance claim follows from those tests.

## Synthetic exam load

Command: `LOAD_STUDENTS=100 LOAD_CONCURRENCY=50 npm run test:load`.

The isolated benchmark uses a local disposable MongoDB, two HTTP listeners in **one Node process**, ten objective questions per exam, and authenticated synthetic students. It excludes password hashing, large question sheets, external AI/OCR/payments and distributed-host/network effects.

| Measurement                                           | Observed                                 |
| ----------------------------------------------------- | ---------------------------------------- |
| Students / concurrent student flows                   | 100 / 50                                 |
| Requests                                              | 1,200                                    |
| Duration / request rate                               | 6.92 seconds / 173.3 requests per second |
| Request latency p50 / p95                             | 228.0 ms / 627.0 ms                      |
| Maximum event-loop delay                              | 302.3 ms                                 |
| Attempts with every expected answer and correct score | 100                                      |
| Request/data-integrity errors                         | 0                                        |

Other test/build activity ran on the local environment. These measurements are reproducible diagnostics, not a promised concurrent-student limit. Run representative staging load/soak tests on the actual API, database and provider plans before publishing capacity figures.

## Release acceptance still required

- Client-owned current academic content, source approval and teacher-labelled AI calibration.
- Real SMTP, private object storage, OCR/AI, optional Twilio and Razorpay sandbox acceptance; only then authorized live activation.
- Physical Android testing, signing/store acceptance, staging soak, production monitoring and backup/restore exercise.

See `CLIENT_HANDOFF.md` for the activation and academic workflow. Handwritten/diagram marks always remain provisional until human review.

## PDF, recovery and packaging checks

PDF tests exercise actual Poppler rendering, ordered/bounded JPEG pages, malformed/oversized/over-capacity rejection, reading/deadline gates, atomic upload quotas, private ownership and partial object-store failure cleanup. Password reset tests verify older links/access/refresh sessions become invalid. Diagnostic tests check staff authorization and absence of credential values.

A real `mongodump`/`mongorestore` 100.13.0 fixture verifies BSON/date/Hindi text and indexes, independent source and restore counts, checksum rejection and refusal to overwrite backups. This optional integration scenario skips when MongoDB tools are absent; CI installs a pinned/checksummed tool bundle. It is not a production backup restoration.

The production-only workspace dependency installation and Sharp runtime check passed. Docker is unavailable in the local environment; the added container CI job must build/exercise the actual image. Expo export includes the document picker and recovery UI; physical-device acceptance remains pending.

## Practice import and native result regression

The admin pack browser flow covers importing/re-importing original draft tests without a terminal on desktop and mobile web. API tests reject student/editor import, validate 80 original bilingual questions and arithmetic keys, keep all generated content unpublished, preserve teacher edits and record the importing administrator. Original questions are illustrative, not an official board paper or verified syllabus. Imports use bounded batches to reduce serial Atlas round-trips.

Native result handler tests execute the compiled component with controlled hooks/API responses: both retry buttons call the correct filter and navigate, simultaneous taps issue one request, failures display without navigation, saved pages render and section-choice exclusions are labelled. Expo Android bundle export passed. This is not physical-device or store-billing acceptance.

## Series discovery and source-question imports

Series integration checks cover scoped publication, class isolation, cursor pagination, literal search, free filters, resume/result state and omission of question IDs/answer keys. Authoring integration checks use controlled vision-provider and private-storage adapters for a real validated photo upload, preserve unknown keys, reject invalid saves, enforce private ownership/read-only administrator evidence access, record a draft-save audit, prevent duplicate commits, cap pending jobs, recover leases and retry provider failures. Paste parser tests preserve multiline Hindi/math and reject invalid keys/duplicate options/oversized imports. Real book OCR accuracy is not established by mocked provider responses.

Browser tests exercise subject-series navigation and paste → compact editable question review → draft test on desktop/mobile, plus clear subject/question validation instead of raw JSON errors. Series and review screenshots were inspected. The final local IPv4 mapping and compact-review refinements were rechecked with targeted authoring and browser flows.

## BSEB setup and real local OCR

All built-in layouts pass the domain's arithmetic/section validation; X Science retains its 6-mark Physics and 5-mark Chemistry/Biology long answers, while Social Science retains five short-answer subgroups. Integration checks exercise idempotent scoped setup, preservation of teacher edits, authorization/independent pattern approval, empty published series, category filters, a full 138-question Mathematics mock and its 195-minute deadline / first 15-minute reading period. Setup stores drafts, not published papers or approved current-year content.

Browser checks use actual bundled Tesseract WASM and English/Hindi models on generated printed PNG fixtures, with no mocked OCR response and no external OCR/CDN requests. Text is corrected before formatting; the real Hindi fixture misread the printed `1.` as `L.` and the English punctuation was also imperfect. These checks establish the working provider-free flow, not general book-page accuracy. Both desktop and mobile emulation reach editable choices and preserve a missing answer key for teacher input. Inline custom subject/chapter creation and the updated series layout fit narrow screens. Live cloud providers, physical-device performance and a representative teacher book corpus still require acceptance testing.
