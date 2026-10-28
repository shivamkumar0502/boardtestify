# Release and recovery operations

## Configuration preflight

Copy `.env.example` to `.env` for local work. Configure the real HTTPS origin, MongoDB URI and a fresh JWT secret for production. Never commit either environment file.

```bash
npm run preflight
npm run preflight -- --strict
```

The command makes no provider calls. It reports missing variable **names**, configuration presence and local Poppler availability. `--strict` exits nonzero when the storage, email or AI configuration is incomplete. Credentials are never included in the report. Configuration presence does not certify a provider or approve release. Staff can see the same report under Administration → Operations.

Use `node --env-file=.env.production scripts/preflight.mjs --strict` to inspect a production environment file without changing the development file.

## Container deployment

Install Docker with Compose on the intended Linux host. Create an untracked `.env.production` using `.env.example`, with production database/provider values, `WEB_ORIGIN=https://your-domain` and a new random JWT secret. The image serves the compiled React site and API together. `VITE_API_URL` is intentionally not embedded into its production build.

```bash
docker compose build
docker compose run --rm api node backend/src/migrate.js
docker compose up -d
```

Compose uses a read-only filesystem, bounded temporary storage, memory/CPU/process limits, log rotation, an API readiness check and a separate evaluation worker. The API binds to loopback port 4000. Configure the host's HTTPS reverse proxy to forward the real domain there, and set the exact `TRUST_PROXY_HOPS`. A host restart uses the configured restart policy. Stop grace allows worker leases to drain or expire for recovery.

Resource limits are starting bounds, not measured capacity. Tune them on staging. The container includes Poppler and Linux process limits for PDF conversion; Linux PDF children have a 512 MiB address-space ceiling, 8-second CPU/wall bounds per invocation and bounded output. Each page is rendered sequentially to at most 2400 pixels on its long side, then decoded/re-encoded as an image. At most two upload operations run per API process. Use the provided host/container memory limits; macOS/Windows development only provides the process timeout and output bounds.

The image is built/tested by the container CI job. Local validation in this development environment covered the production dependency install and Sharp runtime; Docker itself was not available here. Wait for the container CI job and exercise the built image on staging before deploying to a client.

## PDF answer sheets

Install `poppler-utils` and `util-linux` on Linux API hosts, or Poppler on macOS (`brew install poppler`). Containers include both Linux requirements. Restart the API after installation. `/api/features.pdfSheets` is true only when storage is configured and the PDF tools can execute. Photo uploads continue to work when PDF support is unavailable.

Students can select a PDF in the website or Android document picker. The server accepts up to 10 MB, rejects malformed/password-protected files and checks the actual page count against the remaining slots. It never silently drops excess pages. Each answer allows four attached pages, including existing photos. Up to eight uploaded pages per question are reserved atomically across API replicas, allowing limited replacement uploads. Reading periods, submission state and deadlines are checked server-side. Uploads must finish and answers must save before the deadline.

Only normalized JPEG page objects are kept in private storage. Original PDFs are temporary and removed after processing; embedded links/scripts/files are not served to students or AI providers. Page OCR/vision and human review use the existing handwritten-answer workflow. All image-based marks remain provisional until teacher review. Object-store lifecycle rules should also clean failed/orphaned objects if a process or provider fails during cleanup.

## Logical database backups and restore drills

Install MongoDB Database Tools (`mongodump` and `mongorestore`) on the operator's trusted machine. Use matching versions for backup and restore. Tools 100.13.0 were tested with the disposable MongoDB fixture. These commands use `MONGODB_URI` from `.env`; the URI must explicitly include the application database name. Grant only the operator permissions needed for backup and creation/inspection of a drill database.

```bash
npm run db:backup -- /secure/backups/boardtestify-2026-10-28.archive.gz
npm run db:restore-drill -- /secure/backups/boardtestify-2026-10-28.archive.gz
```

Create the backup directory first. Each backup has an adjacent `.manifest.json` containing its checksum and source database name. Existing files are never overwritten. On POSIX systems both files use owner-only permissions. Mongo tools read credentials from a temporary owner-only configuration file, removed afterward; URI/password values are not command arguments or report fields.

Restore verifies the archive checksum before restoring into a fresh `bt_restore_*` database. It never uses `--drop` or restores into the source namespace. It lists restored collection counts and retains the new database for operator inspection; the source remains unchanged. Use a trusted manifest from the same backup. Keep backup files in encrypted, access-controlled offsite storage. The archive contains private student/authentication data; it is excluded from Git and Docker builds.

A logical dump while writes continue is **not** a point-in-time snapshot across collections. Use the database provider's managed snapshots/PITR for the production recovery objective. The drill does not restore S3 images, prove point-in-time consistency or start the application on restored data. Complete object-store recovery, application-level acceptance and restore drills on the actual client environment before release. Review and remove retained drill databases through the operator's normal database tooling when finished.

## Remaining acceptance

The source cannot supply the client's paid-service accounts, signing identity, hosting or teacher-labelled content. Complete current-session academic approval, teacher AI calibration, real provider sandbox acceptance, signed Android/physical-device testing, HTTPS/monitoring setup and representative staging load/soak tests. Native purchases still use the website; a store-native billing implementation requires an explicit distribution/billing choice.
