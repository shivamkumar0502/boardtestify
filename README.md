# BoardTestify

**Practice Smart. Prepare Better. Score Higher.**

Bihar Board Class 10 and Class 12 (Arts, Science, Commerce) preparation. React **JavaScript/JSX**, Node.js/Express **JavaScript**, MongoDB/Mongoose and React Native/Expo **JavaScript/JSX**. The interface uses black/charcoal surfaces and orange accents. There are no general competitive-exam modules.

## Run locally

Requirements: Node.js 22+, npm, a local MongoDB server or MongoDB Atlas database.

```bash
npm ci
cp .env.example .env
```

Edit `.env`: set `MONGODB_URI`, generate your own `JWT_SECRET` (48+ random characters), and keep `WEB_ORIGIN=http://localhost:5173` for development. Do not commit `.env`.

```bash
npm run seed
npm run dev
```

Open `http://localhost:5173`. Register a student account. A Class 10 / General student can try the original, clearly labeled two-question sample. The seed is idempotent and **does not claim to contain official BSEB questions, syllabus, or exam patterns**. Other classes/streams show approved content when administrators add it.

Create your first super administrator by setting `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the shell for this command:

```bash
npm run admin
```

The password must contain 12+ characters. No default administrator credentials exist. Register a separate staff account and promote it in Administration → Users. Question authors cannot approve their own questions. Configure subjects for the right session/class/stream, add chapters, save questions as drafts, have another administrator approve them, then publish a test.

## Workspace

| Path                  | Responsibility                                                                                |
| --------------------- | --------------------------------------------------------------------------------------------- |
| `apps/web`            | React/Vite, React Router, Tailwind, student dashboard, CBT, results and administration        |
| `apps/api`            | Express REST API, auth, RBAC, content, attempt persistence, evaluation queue and integrations |
| `apps/mobile`         | Native Expo Router student app, secure refresh tokens, exam and result screens                |
| `packages/domain`     | Shared Zod validation, question states, scoring and AI evaluation arithmetic                  |
| `packages/api-client` | Shared HTTP client and error type                                                             |
| `tests`               | Unit, MongoDB-backed API integration and browser tests                                        |

No application source uses TypeScript. Type packages appearing in the lockfile are transitive tooling dependencies.

## Implemented flows

- Email/password registration, login, web refresh cookie, mobile refresh-token rotation, logout and SMTP-backed password reset.
- Five server-enforced roles; student class/stream filtering; staff accounts and audit logs.
- Session-versioned subject/chapter/topic records; question drafts, second-person publication, test publication and versioned snapshots.
- Single/multiple choice, numerical, short/long answers; bilingual question text, optional images, negative marks, section instructions, randomized selection and internal-choice answer limits.
- Server deadlines, resume, answer revision checks, atomic submission, timeout finalization, durable answer queue on the web/native client, review palette and final/provisional results.
- Persistent MongoDB evaluation jobs, optional server-side AI provider, validated criterion scores, low-confidence/failure manual review and recorded human corrections.
- CSV/XLSX preview/import with row errors and duplicate detection; AI-assisted question drafts requiring approval.
- Score/progress dashboard, one-time Razorpay 30-day study pass with captured-payment verification, signed webhooks and idempotent entitlements.
- Private S3 image upload policy and attempt-scoped signed image retrieval.

## Android development

Set `EXPO_PUBLIC_API_URL` to an API address accessible to the device. An Android emulator can use `http://10.0.2.2:4000/api`; a physical device needs your computer's LAN address or an HTTPS server. Run from `apps/mobile`:

```bash
npm run dev
npx expo install --check
```

The app supports registration/login, test catalog, attempts, native CBT, queued answer saves, secure session storage and results. Staff administration, password-reset links and payment checkout currently use the website.

`eas.json` includes APK preview and Android App Bundle production profiles. Building a release `.aab` requires an Expo/EAS account or an Android build environment and your own signing credentials. No signed Android release is included here. Change the package ID if your organization owns a different application ID.

## Checks

```bash
npm run check
npm test
npm run test:integration
npm run build
npx playwright install chromium
npx playwright test
```

Integration and E2E tests start an isolated MongoDB instance (first run downloads MongoDB). `TEST_MONGODB_URI` can point integration tests at a **dedicated disposable test database**: the tests delete its contents. Never use a production database. E2E tests use actual API/database flows, not mocked scoring.

## Configuration and release status

See [deployment](docs/DEPLOYMENT.md), [API](docs/API.md), [CBT engine](docs/CBT_ENGINE.md), [AI evaluation](docs/AI_EVALUATION.md), [database](docs/DATABASE.md) and [scope](docs/PRD.md).

This is a functional initial implementation, not a claim that the entire master specification is production-certified. Official academic content and exam distributions must be verified and approved before use. Provider credentials, real payment/webhook testing, Android device/release testing, privacy/retention policies, backups and load testing remain release work. Handwritten answer-sheet OCR, diagram interpretation, phone OTP, a full translation of every screen, announcements and polished field-by-field question/test builders are not implemented. Current staff question/test editing uses validated JSON. AI supports typed descriptive answers; it is feedback for practice, not official BSEB grading.
