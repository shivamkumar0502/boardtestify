# BoardTestify

**Practice Smart. Prepare Better. Score Higher.**

Bihar Board Class 10 and Class 12 Arts, Science and Commerce preparation. React **JavaScript/JSX**, Node.js/Express **JavaScript**, MongoDB/Mongoose, and React Native/Expo **JavaScript/JSX**. Black/charcoal UI with orange accents; Hindi and English interface catalogs. No general competitive-exam modules.

## Run from VS Code

Requirements: Node.js 22+, npm and local MongoDB or MongoDB Atlas. PDF uploads/tests additionally require Poppler (`pdfinfo` and `pdftoppm`), plus `util-linux` on Linux. Photo uploads do not require Poppler.

```bash
npm ci
cp .env.example .env
```

On Windows, copy `.env.example` to `.env` using Explorer or `copy .env.example .env`. Configure `MONGODB_URI`, `WEB_ORIGIN=http://localhost:5173` and a random `JWT_SECRET` of at least 48 characters. Generate a secret locally with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

```bash
npm run migrate
npm run seed
npm run dev
```

Open **http://localhost:5173**. Register a Class 10 / General account to try the clearly labeled original sample test. The seed also adds official 2026 reference links, subject metadata and five **draft** model-paper patterns; it does not create a complete official question bank or guess current-session chapters.

## Separate application folders

| Folder                 | Purpose                                               | Command from repository root |
| ---------------------- | ----------------------------------------------------- | ---------------------------- |
| `frontend/`            | React website, student screens, visual administration | `npm run dev:frontend`       |
| `backend/`             | Express API, MongoDB, authentication and integrations | `npm run dev:backend`        |
| `app/`                 | Native Expo student application                       | `npm run dev:app`            |
| `packages/domain/`     | Runtime schemas, scoring and answer states            | Shared                       |
| `packages/api-client/` | JSON and multipart HTTP client                        | Shared                       |
| `packages/i18n/`       | Hindi/English interface translations                  | Shared                       |

Install from the repository root so npm links shared workspaces. `npm run dev` starts frontend and backend together.

## Implemented product flows

- Email/password registration, password reset through SMTP, secure web/native sessions, phone linking and OTP sign-in through Twilio Verify, profile/class/stream/language updates, and five server-enforced roles.
- Visual question and test editors: academic selectors, MCQ options/keys, descriptive references, alternatives, configurable quarter/half/whole-mark rubrics, diagrams, images, sections, random selection, internal choices and source-backed patterns. Advanced JSON remains optional.
- Subject/chapter/topic administration, source verification, draft/review/publication controls, CSV/Excel question import with per-row validation, archive expansion checks and duplicate detection, and AI-assisted original question drafts.
- Persistent CBT attempts with server deadlines, optional reading periods, autosave/offline queues, revision checks, reconnect/resume, review palettes, repeat-safe submission, timeout finalization and immutable question snapshots.
- Practice feedback after saving objective answers and targeted retry of incorrect or unanswered questions. Full mocks keep answer keys hidden until submission.
- Typed answer evaluation, handwritten photo uploads and multi-page PDF uploads. Validated/re-encoded private images go through Google Vision OCR; an image-capable configured AI model can inspect handwriting/diagrams. Teacher review is required for handwritten/diagram marks. Invalid or unavailable providers do not become zero marks.
- Student results/progress, official-reference library, class/stream-scoped announcements, administrative queue/health counters and compact audit history.
- Configurable one-time study plans and Razorpay recurring subscriptions, provider-verified captured payments, invoice/subscription matching, cancellation of renewals, full-refund access revocation and replay-safe entitlements.

## Administration

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in your shell, then run `npm run admin`. The password must contain at least 12 characters. No default production credentials exist. Remove the bootstrap password environment variable afterward.

Register a second staff account and promote it through a super administrator. Question authors cannot approve their own latest changes. Academic source verification and pattern approval also require a different administrator. A board mock must match an approved pattern's subject/session, duration, counts, marks and question types.

Use the seed's historical 2026 models as references only. The Science model's summary question count differs from its detailed instructions; its draft configuration follows the detailed section instructions and still needs teacher approval. Current syllabus chapters/PYQs and marking rubrics must be supplied or verified by the client’s academic team before publishing courses.

## Reliable deployment

Build with `npm ci && npm run build`. Run `npm run migrate` against the intended database before starting production processes. Start the API with `npm start -w @boardtestify/api`; it serves the React build and `/api` on one origin.

For multiple API replicas, set `RUN_WORKER=false` on API processes. Run `npm run worker` separately with the same database/provider configuration and bounded `WORKER_CONCURRENCY`. MongoDB-backed rate windows and fenced evaluation leases are shared across replicas. Set `TRUST_PROXY_HOPS` to the exact number of trusted reverse proxies, not an unrestricted trust flag.

Connection pools, wait queues, body sizes, upload pixels, import expansion, heavy reads, authentication and worker concurrency are bounded. Readiness is `/api/health`; liveness is `/api/live`. These controls reduce overload risk, but cannot guarantee that an untested hosting plan will never fail.

## Android

Set `EXPO_PUBLIC_API_URL` to your HTTPS API or emulator-reachable development URL. An Android emulator can use `http://10.0.2.2:4000/api`. Run `npm run dev:app`. Native students can register/sign in, link phones, switch language, see announcements/references, edit profiles, attempt exams, photograph/upload answers, select answer PDFs, request password-reset emails, view feedback and retry questions. Subscription status/cancellation are available; purchases and staff administration use the website in this version.

`app/eas.json` defines preview APK and production AAB profiles. A JS bundle export is not a signed Android release. Expo/Android signing credentials and real-device acceptance are required before distribution.

## Release tooling

`npm run preflight` reports missing integration configuration without sending provider requests. Administration → Operations shows the same checklist. `Dockerfile` and `compose.yaml` provide a Linux API/worker setup with Poppler, resource bounds and health checks. `npm run db:backup` and `npm run db:restore-drill` support checksummed database archives and isolated recovery drills. See [operations guide](docs/OPERATIONS.md) for setup and remaining client acceptance.

## Validation

```bash
npm run check
npm test
npm run test:integration
npm run test:e2e
npm run test:load
```

First browser run: `npx playwright install chromium`. Integration/load/browser tests use isolated MongoDB instances. `TEST_MONGODB_URI`, if used by the original integration suite, must refer to a **disposable** database: that test deletes its contents. Never point tests at production.

`npm run test:load` runs a disposable synthetic exam workload, not a public load attack or a hosting-capacity certificate. `npm run calibrate -- /absolute/path/teacher-cases.json` evaluates teacher-labelled typed-answer cases using your actual AI configuration; it never grants automatic release approval.

See [client handoff](docs/CLIENT_HANDOFF.md), [validation evidence](docs/QA.md), [deployment](docs/DEPLOYMENT.md), [API](docs/API.md), [CBT](docs/CBT_ENGINE.md), [AI evaluation](docs/AI_EVALUATION.md), and [scope](docs/PRD.md).

No real paid-provider activation, official-content approval, signed AAB, production deployment, backup restoration or physical-device certification is implied by local tests.

## BSEB source-based mini tests

`npm run seed:bseb` imports five reviewable draft mini tests (15 bilingual MCQs) based on the official 2026 Matric/Intermediate model-paper topics: Class 10 Mathematics/Science and Class 12 Physics, History and Accountancy. Run migrations first. These are adapted practice sets with suggested keys, not full official papers or approved 2027 content. See [test pack and publication steps](docs/BSEB_TEST_PACK.md).
