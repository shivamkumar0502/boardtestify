# Production readiness and real-student acceptance audit

**Audit baseline:** `main` after PR #27 (30 October 2026).  
**Purpose:** distinguish implemented source workflows from evidence that must come from the client's real providers, academic reviewers, devices and production environment.  
**Release decision:** **NOT READY FOR PUBLIC PRODUCTION** until the blocking acceptance gates below are evidenced. This is an evidence-based gate, not a claim that the listed application features are missing.

## 1. Current evidence from the repository

The existing `docs/QA.md`, `docs/OPERATIONS.md`, `docs/DEPLOYMENT.md`, `docs/CLIENT_HANDOFF.md`, `docs/CBT_ENGINE.md` and `docs/AI_EVALUATION.md` describe these implemented/tested source capabilities:

| Area | Repository evidence | What this does not prove |
|---|---|---|
| CBT lifecycle | Browser tests cover registration, exam, persisted/reloaded answers, submission/results; API tests cover deadlines, reading time, choices, conflicts and recovery | Real student usability on physical low-end devices or unstable mobile networks |
| Academic authoring | Visual question/test authoring, source/pattern review, independent publication, imports and BSEB PDF/photo draft import | Accuracy/completeness of current-session official papers, answer keys or syllabus |
| Descriptive evaluation | Rubric validation, durable jobs, manual-review fallback and teacher review gates | Marking accuracy on a representative teacher-labelled Hindi/English corpus |
| Billing | Contract tests cover captured payments, subscriptions, cancellation, refunds and replay handling | Razorpay account/webhook configuration, sandbox acceptance or live transactions |
| Operations/security | Preflight, bounded API/upload processing, role checks, audit logs, Docker image CI and backup/isolated restore-drill commands | Production secrets, HTTPS/proxy configuration, live monitoring, object-store recovery or a client-environment restore |
| Responsive web | Playwright desktop Chrome and Pixel 5 mobile-web emulation | Physical iOS/Android/tablet browser and accessibility acceptance |
| Android | Expo Android bundle export in CI | Signed APK/AAB, physical-device acceptance, store approval or production distribution |

The existing QA evidence reports 24 browser tests across desktop and Pixel 5 emulation and synthetic load of 100 students / 50 concurrent flows in a single Node process against disposable local MongoDB. It explicitly does **not** certify production capacity. Re-run current CI before release; the historical QA document date is 28 October 2026.

## 2. Release-blocking acceptance gates

These are external evidence gates. Do not mark them complete based on mocked adapters, source code, or CI alone.

### A. Official academic content and BSEB paper validation — BLOCKED: academic owner input required

For each intended exam session, class and stream:

- Obtain the official source PDF and record URL, retrieval date, session, class, stream, subject and file checksum.
- Two qualified reviewers independently compare every imported question against the PDF: Hindi/English text, numbering, options, formulas, diagrams, subparts, internal choices, section membership and page.
- Verify marks, duration, attempt limits and section totals against the source. Resolve discrepancies with a documented academic decision; never infer a rule from an ambiguous header.
- Verify every answer key and descriptive reference/rubric against an approved marking scheme. AI suggestions remain unverified until a teacher signs them off.
- Record reviewer identities, timestamps, source version/checksum, question IDs and disposition (approved/corrected/rejected). Publish only after independent approval.
- Test a student account from the matching class/stream can see the published paper and other classes/streams cannot.

**Evidence to attach:** source PDF/checksum, completed question-by-question review export, signed marking-scheme approval, approved pattern snapshot and student visibility screenshots. The repository's 2026 reference links and draft patterns do not establish 2026–27/2027 syllabus or rules.

### B. Real student exam acceptance — BLOCKED: staging cohort/device run required

Run a supervised staging session with consenting students/test accounts on representative physical devices and networks:

- Low-end Android phone, current Android phone, iPhone/Safari if supported, tablet, laptop/desktop.
- Narrow viewport, landscape/portrait changes, Hindi keyboard/IME, long Hindi answers, image/PDF uploads and camera/gallery permissions.
- Start, reading period, timer drift, refresh, background/resume, token expiry, network loss/reconnect, queued saves, stale-answer conflict, deadline boundary and auto-submit.
- Verify no answer is lost or silently overwritten; compare server-stored answer revisions and final result with the student's submitted work.
- Exercise MCQ, numerical, short/long text, internal choices, mark-for-review and uploaded answer pages.
- Record device/browser/OS, network conditions, test/attempt IDs, timestamps, screenshots/video and observed defects.

**Pass criteria:** all saved answers reconcile with the server; deadlines are enforced server-side; no cross-student data exposure; no critical/high-severity usability defects remain.

### C. AI evaluation calibration — BLOCKED: teacher-labelled dataset required

- Build a consented, de-identified set of real student responses across Hindi/English, subjects, mark bands, handwriting quality, diagrams and common misconceptions.
- Two teachers independently score each answer with the approved rubric; resolve disagreements to a reference score.
- Run the exact production model/provider/configuration and retain model/version, prompt/config version, rubric version, input/output, confidence/review route and latency.
- Report exact-match rate, mean absolute mark error, within-one-mark rate, false auto-accept rate, manual-review rate and per-language/subject/mark-band breakdown.
- Set acceptance thresholds with the academic owner before running the evaluation. Do not invent thresholds after seeing results.
- Handwritten/diagram marks remain provisional until human approval. Provider failures/unreadable content must route to review, not automatic zero.

**Pass criteria:** academic owner signs the measured report and accepts thresholds; no automatic release based solely on model confidence.

### D. Security and privacy — PARTIALLY COVERED BY TESTS; LIVE DEPLOYMENT REVIEW REQUIRED

Before production:

- Run `npm run preflight -- --strict` in the exact production environment. Review missing configuration by variable name only; never paste secrets into issues or logs.
- Confirm HTTPS, secure cookie settings, exact `TRUST_PROXY_HOPS`, CORS/origin policy, rate limits, role boundaries and administrator MFA/credential policy as applicable.
- Test student-to-student isolation for attempts, answers, uploaded pages, signed URLs and exports; test author cannot approve own content and reviewer evidence access is audited.
- Verify secrets are backend-only, rotated, least-privilege and excluded from repository/build artifacts.
- Review data retention/deletion, consent, privacy notice, incident response, access logs and applicable legal obligations with the operator.
- Run dependency/security scanning and a production-like authorization test. Record findings and remediation; do not describe this source audit as a penetration test.

### E. Payments and external providers — BLOCKED: client-owned sandbox accounts

- Configure Razorpay test keys and signed webhook endpoint; verify captured payment, recurring authorization/renewal, cancellation, full/partial refund, duplicate/reordered webhook delivery and entitlement revocation.
- Verify email reset flow using real SMTP test delivery; verify private S3-compatible object storage upload/read/delete and lifecycle policy.
- If phone OTP is enabled, verify Twilio Verify in permitted regions and check cost/rate controls.
- Verify Gemini and optional Vision/OCR using the actual project, quota, model and regional settings; check timeouts, quota exhaustion, invalid responses and manual-review fallback.
- Confirm provider dashboards/webhook delivery logs reconcile with application audit and entitlement state. Only then schedule a separately approved live-mode activation.

### F. Backup, restore and disaster recovery — BLOCKED: production restore drill required

- Configure encrypted offsite MongoDB managed snapshots/PITR and record RPO/RTO approved by the owner.
- Run logical backup and isolated restore drill using the documented commands; verify checksum, collection counts, indexes, sample Hindi text, attempts, subscriptions and audit history.
- Restore object-store evidence separately and verify ownership/private access. A MongoDB-only restore does not restore image/PDF objects.
- Perform application-level smoke tests against the isolated restored environment; document recovery time, data gap, operator and evidence.
- Confirm retention, alerting, access control and periodic drill schedule. Never test destructive restore against production.

### G. Responsive and accessibility acceptance — BLOCKED: physical-device run required

- Exercise student, author, reviewer and admin flows at phone (320/360/390 px), tablet and desktop widths, portrait and landscape.
- Check no horizontal overflow, clipped dialogs/tables, hidden primary actions, unreachable controls, keyboard traps or unreadable Hindi text.
- Check touch target size, keyboard-only navigation, focus visibility, labels/errors, contrast and screen-reader names.
- Test zoom/text scaling and long content, not only the dashboard landing page.
- Attach screenshots and device/browser matrix; fix critical/high defects before sign-off.

### H. Hosting, monitoring and capacity — BLOCKED: actual staging/production plan required

- Deploy the exact commit/container to staging with separate API and worker processes, real database/provider sandbox, TLS reverse proxy and readiness/liveness probes.
- Verify migrations are backed up and run once before deployment; API replicas must not run production DDL/index creation.
- Run representative load and soak against the actual hosting/database/provider plan, including large papers, concurrent saves, uploads and evaluation queue backlog.
- Record p50/p95/p99 latency, error rates, event-loop delay, DB pool saturation, memory/CPU, worker queue age, provider latency/cost and recovery after restart.
- Configure alert routing, dashboards, log redaction, incident owner and rollback procedure. The local synthetic benchmark is not a public concurrency promise.

### I. Android distribution — BLOCKED: owner signing/device acceptance

- Produce a signed preview APK and production AAB with owner-controlled Expo/EAS credentials.
- Install on physical supported devices and test login, Hindi typing, exam start/resume, uploads, network recovery, notifications/links as applicable and token expiry.
- Confirm privacy/store disclosures, target SDK, permissions and billing/distribution policy. Current native purchase checkout and staff administration use the website.
- Store review and distribution approval are separate from a successful JS bundle export.

## 3. Execution order

1. **Academic content pack:** client supplies official current-session PDFs and two named reviewers. Complete one Class 10 and one Class 12 stream subject end-to-end first.
2. **Staging release:** owner supplies staging domain, MongoDB, private storage, SMTP, AI and payment sandbox credentials through secret manager/environment—not chat or Git.
3. **Physical-device student pilot:** run a small supervised cohort; log and fix all critical/high defects.
4. **AI calibration and provider acceptance:** teacher-labelled dataset and provider sandbox evidence.
5. **Security/recovery/load gates:** operator runs the documented checks on staging, including actual object-store restore and soak.
6. **Release review:** collect signed academic, student, security, operations and Android acceptance. Only then enable production traffic/live payments.

## 4. Sign-off record

Use this table during the pilot; do not fill names/results with assumptions.

| Gate | Owner | Status | Evidence link / run ID | Sign-off date |
|---|---|---|---|---|
| Official papers and marking schemes | Academic lead + independent reviewer | BLOCKED | Pending source PDFs and reviewer sign-off | — |
| Student physical-device pilot | QA/student pilot lead | BLOCKED | Pending device matrix and attempt IDs | — |
| AI evaluation calibration | Academic lead | BLOCKED | Pending teacher-labelled dataset/report | — |
| Security/privacy deployment review | Security/operator | BLOCKED | Pending production configuration and review | — |
| Razorpay/email/storage/AI sandbox | Integration owner | BLOCKED | Pending provider sandbox logs | — |
| Database + object-store recovery | Operations owner | BLOCKED | Pending production-like restore drill | — |
| Responsive/accessibility device review | QA lead | BLOCKED | Pending screenshots and defect closure | — |
| Hosting load/soak and monitoring | Operations owner | BLOCKED | Pending staging metrics and alert test | — |
| Signed Android/device/store acceptance | App release owner | BLOCKED | Pending signed build and device report | — |

## 5. Commands already available in the repository

Run from repository root in a disposable/staging environment as appropriate:

```bash
npm ci
npm run check
npm test
npm run test:integration
npm run test:load
npm run build
npx playwright install chromium
npx playwright test
npx expo export --platform android --output-dir ../android-export
npm run preflight -- --strict
npm run db:backup -- /secure/backups/boardtestify.archive.gz
npm run db:restore-drill -- /secure/backups/boardtestify.archive.gz
```

Do not run restore drills against production. Integration tests may delete their configured test database; use a disposable `TEST_MONGODB_URI`.

## 6. Audit conclusion

The repository already implements many of the workflows listed in the product scope. The highest-risk remaining work is **not another feature screen**: it is proving the current-session academic content is correct, real students can complete exams reliably on physical devices, AI marks are calibrated by teachers, and the client's actual provider/hosting/backup environment behaves correctly.

This audit document creates an explicit release gate and evidence register. It does not claim that external accounts were configured, official papers were academically verified, students were tested, a security penetration test was performed, or production data was backed up/restored.
