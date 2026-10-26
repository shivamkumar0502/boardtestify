# Deployment

## Website + API on one origin

Use a Node.js host with MongoDB Atlas (or a managed MongoDB instance). A single Node service serves both the built React app and `/api`, so refresh cookies work without cross-site-cookie assumptions.

Build: `npm ci && npm run build`

Start: `npm start -w @boardtestify/api`

Set production environment variables in the host:

- `NODE_ENV=production`
- `PORT` (provided by the hosting service where applicable)
- `MONGODB_URI` (least-privilege application database user, TLS enabled)
- `JWT_SECRET` (48+ random characters)
- `WEB_ORIGIN=https://your-website-domain`

Leave `VITE_API_URL` unset for the production web build: the client uses `/api`. For a separate web/API setup, configure `VITE_API_URL` at build time and use the same site with an explicit cookie policy; do not assume unrelated host subdomains share cookies.

Health endpoint: `/api/health`. The process waits for database connection and indexes before listening. The server finalizes expired attempts when they are accessed and in the queue loop. Process suspension may delay background evaluation; expired answers are still rejected on access.

Bootstrap an administrator with the CLI, then unset its password environment variable. Run `npm run seed` only if illustrative content is desired. There are no hardcoded live credentials. Keep staging and production databases, storage prefixes, provider keys and webhook endpoints separate.

## AI

Set `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` to a provider supporting OpenAI-compatible `chat/completions` JSON-object responses. The key stays server-side. A provider without this response format needs an adapter. Without AI configuration, nonempty descriptive answers go to manual review. Never substitute keyword matching or zero marks for provider failures.

## Email

Set `SMTP_URL` and `MAIL_FROM` to activate password reset. Verify the sender at your provider and test delivery. Password reset is otherwise explicitly unavailable. Phone OTP is not provided.

## Payments

Set `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and optional `PASS_PRICE_PAISE`. Configure the provider webhook to `https://your-domain/api/billing/webhook`, including `payment.captured`. Verify the webhook in test mode and retry duplicate delivery before switching keys. Client checkout success never grants access alone. The server fetches the payment, verifies capture, order, amount and currency. A paid order is its own entitlement record; repeated verification does not extend access. This is a one-time 30-day pass, not recurring billing. Refunds and disputes require manual operational handling in this version.

## Storage

Set `S3_BUCKET`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, and optional S3-compatible `S3_ENDPOINT`. Use a private bucket, a least-privilege service identity and a browser CORS policy allowing your web origin to POST uploads. Upload policies expire in 5 minutes and constrain size/type. Signed GET URLs are available only for an image in the requesting student's attempt. File validation currently checks declared MIME/size and image-key shape; add content inspection/re-encoding and an upload-finalization scanner before accepting images from untrusted authors at scale. Some S3-compatible vendors do not implement POST policies; use a compatible vendor or add its adapter.

## Operational limits

Rate limiting currently uses process memory. Run one API instance or replace it with a shared limiter before horizontal scaling. Configure a trusted reverse proxy explicitly for your host; do not blindly trust incoming forwarding headers. Queue jobs have MongoDB leases and compare-and-swap revisions. Monitor failed queue ticks, latency, provider costs, manual-review backlog and database health. Server errors include request IDs; avoid logging submitted answers or credentials. Configure retention, deletion requests and backups separately, and verify restoration. No production deployment was performed by committing this project.

## Android

Set the HTTPS `EXPO_PUBLIC_API_URL` in the EAS build environment. From `app`, use `eas build --platform android --profile production` after signing into your own Expo account and configuring Android signing. A successful JS bundle export is not a signed `.aab` or device certification. Test low-resolution devices, reconnects, background/resume, Hindi input, token expiry and timer behavior before Play Store release.
