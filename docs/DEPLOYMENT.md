# Deployment and scaling

## Build, indexes and startup

Use Node.js 22+ and a managed MongoDB database. The API serves `frontend/dist` and `/api` on the same origin, so web refresh cookies do not depend on cross-site cookie support.

1. Build: `npm ci && npm run build`.
2. Configure the host environment from `.env.example`, including `NODE_ENV=production`, the actual HTTPS `WEB_ORIGIN`, `MONGODB_URI`, and a new random `JWT_SECRET`.
3. Run `npm run migrate`. It creates/ensures indexes and backfills compact attempt summaries/answer tracking with revision checks; it does not change saved answers. Take a database backup before applying migrations to an existing client installation. Production disables automatic background index creation.
4. Start API: `npm start -w @boardtestify/api`.
5. Bootstrap administrators and verify academic content before publishing tests.

Leave `VITE_API_URL` unset when building the same-origin production site. The client defaults to `/api`. Development uses `http://localhost:4000/api` and `WEB_ORIGIN=http://localhost:5173`. Separate web/API hosting requires a deliberate same-site cookie setup.

## Separate workers and replicas

Set `RUN_WORKER=false` on API replicas. Start `npm run worker` as a separate process/service with the same MongoDB, S3, OCR and AI settings. `WORKER_CONCURRENCY=2` is the default; increase it only after measuring provider quotas, CPU and memory. Local development can leave `RUN_WORKER=true`.

Evaluation work remains in MongoDB attempt records. A claim includes a unique lease token, a 60-second expiry and a 20-second heartbeat. Updates require both the token and attempt revision, so crashed workers can be replaced and stale workers cannot overwrite newer human reviews. Provider failures, missing configuration and unreadable pages become manual-review states with null marks. API restarts do not erase jobs.

MongoDB-backed fixed-window rate limits work across replicas without requiring Redis. They add database writes; measure this workload and consider a shared Redis limiter when volume justifies it. Pools default to `DB_POOL_MAX=30`, with finite wait, selection and socket timeouts. Each replica/worker has its own pool: include all processes when planning the database connection budget.

`API_CONCURRENCY=150` bounds admitted API work. Heavy attempt/result reads and image/import/authentication processing have smaller gates. Normal JSON is capped at 384 KB; question import routes allow 3 MB behind a two-request gate. Photos are limited to 5 MB and 12 million source pixels; PDFs to 10 MB and four pages. There are two simultaneous upload operations per API process and four attached pages per answer. Image bytes are decoded/re-encoded as JPEG, metadata is removed, and Sharp's cache/thread count is bounded. CSV/XLSX archives undergo metadata and streamed decompression checks before Excel parsing.

The server returns 429/503 with retry guidance instead of admitting unbounded work. Client answer queues retry transient save failures. A 409 is preserved as a conflict requiring explicit reconciliation; the client never blindly overwrites newer server data.

## Health and monitoring

`/api/live` reports a running HTTP process. `/api/health` checks MongoDB readiness and returns 503 when disconnected. Use readiness for routing and liveness for process supervision. Administrative Operations shows pending attempts, manual reviews, expired attempts awaiting finalization, stored-page counts, API uptime and memory. Use host monitoring for aggregate CPU, memory, database/provider latency, errors and worker restarts.

Set `TRUST_PROXY_HOPS` to your host's exact trusted proxy depth. Leaving it at zero is correct for direct local access; an incorrect value can group users under the wrong IP or trust forged forwarding headers. Graceful shutdown stops HTTP acceptance, drains work and has a finite timeout; unfinished evaluation leases are recovered later.

Hashed static assets have long-lived cache headers; HTML and student/API responses do not. Scale actual hosting resources from measured workloads, not the local synthetic benchmark alone. A sleeping/free instance can delay evaluation, even though late answer changes remain blocked by server deadlines.

## Optional providers

- **AI:** `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`. The adapter expects OpenAI-compatible JSON-object chat responses. Set `AI_VISION_ENABLED=true` only for an image-capable model. Calls are timed/bounded and a short circuit breaker reduces repeated outage calls. Handwritten/diagram marks always require teacher confirmation.
- **Handwriting:** `OCR_API_KEY` for Google Cloud Vision `DOCUMENT_TEXT_DETECTION`, with Hindi/English hints. Restrict the key to the Vision API/server usage. Uploaded evidence can be reviewed manually when OCR fails. Input supports page photos (JPEG/PNG/WebP) and PDFs, rendered into private image pages by Poppler. See OPERATIONS.md for tool/process limits.
- **Storage:** private S3-compatible `S3_BUCKET`, region, credentials and optional endpoint. Server-side uploads require PutObject/GetObject/DeleteObject rights. URLs expire after 5 minutes and are accessible only to the answer owner or authorized evaluators. Use HTTPS for browser-accessible signed URLs. `ATTACHMENT_RETENTION_DAYS=90` schedules deletion of expired image objects and metadata; configure this to the client’s retention requirements. Saved attempt scores remain after evidence retention expires.
- **Email:** `SMTP_URL` and verified `MAIL_FROM` activate reset emails.
- **Phone:** Twilio Account SID, Auth Token and Verify Service SID activate phone linking and OTP sign-in. International numbers are required. Code checks have attempt limits, short expiry, rate limits and one-use consumption. The app does not store plaintext OTPs. Configure SMS costs, regional permissions and sender requirements with the provider before activation.
- **Payments:** Razorpay key ID/secret and webhook secret. Create one-time plans in Administration. For recurring plans, create a matching provider plan first; server checkout verifies its price/currency/period. Configure signed events for `payment.captured`, relevant `subscription.*` events and `refund.processed`. Test capture, mandate authorization, renewals, cancellation, refund and duplicate/reordered delivery before live keys. Authorization alone does not grant study access. Partial refunds and disputes require operational review.

Provider secrets stay on the backend. Real SMS, emails, payments and AI costs were not triggered by local contract tests.

## Android and client acceptance

Set HTTPS `EXPO_PUBLIC_API_URL` in your Android build environment. From `app/`, run `eas build --platform android --profile production` with your own Expo/signing credentials. Test low-resolution devices, Hindi typing, photo permissions, large images, reconnects, background/resume, token expiry and exam deadlines. The mobile app exposes subscription status/cancellation; purchase checkout and administration currently use the website. Review store distribution/billing requirements before release.

Configure database/object-store backups, restore drills, retention/deletion processes, incident ownership, alerts and client access. No production hosting change or restore drill was executed as part of source implementation.

## Repeatable release tooling

See [OPERATIONS.md](OPERATIONS.md) for configuration preflight, the Docker/Compose API-worker setup, PDF dependencies and logical backup/isolated restore-drill commands. Provider credentials and live acceptance, production recovery, current academic approval and Android signing/device testing remain client-specific release steps.

## Slow Atlas connections during local startup

A successful standalone connection does not exercise application model startup. Collection/index initialization now runs sequentially in development/test, with automatic Mongoose DDL disabled before models compile. Production API/worker startup does not create collections or indexes; run migrations before release. Existing collections and documents are preserved.

`DB_SELECTION_TIMEOUT_MS` defaults to 30000. `DB_WAIT_QUEUE_TIMEOUT_MS` defaults to 5000 to bound production queues. For a slow local Atlas connection, set the latter to 30000 in the root `.env`, stop old API processes and restart. These bounded settings do not fix a network outage or guarantee access to an unavailable primary. Do not increase `DB_POOL_MAX` blindly to work around connection establishment delays.
