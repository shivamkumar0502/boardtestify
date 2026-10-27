# REST API

Base path `/api`. JSON errors return `message`, optional validation `details`, and an `X-Request-ID` response header. Authenticated requests use `Authorization: Bearer <access token>`. Access tokens last 15 minutes; web refresh sessions last 7 days. Web clients use a HttpOnly refresh cookie; native clients store a rotated refresh token in SecureStore. Access tokens remain valid until expiry after ordinary logout; password reset invalidates them immediately via the user auth version.

| Method   | Path                                                                | Access / behavior                                           |
| -------- | ------------------------------------------------------------------- | ----------------------------------------------------------- |
| GET      | `/health`, `/features`                                              | Public health / configured feature availability             |
| POST     | `/auth/register`, `/auth/login`                                     | Student registration / web sign in                          |
| POST     | `/auth/refresh`, `/auth/logout`                                     | Web refresh cookie / logout                                 |
| POST     | `/auth/mobile-login`, `/auth/mobile-refresh`, `/auth/mobile-logout` | Native sessions, one-use refresh rotation                   |
| POST     | `/auth/forgot-password`, `/auth/reset-password`                     | SMTP reset workflow                                         |
| GET      | `/auth/me`                                                          | Current profile                                             |
| GET      | `/academics`, `/tests`, `/attempts`, `/analytics`                   | Student-scope content / activity                            |
| POST     | `/tests/:id/start`                                                  | Start or resume with entitlement check                      |
| GET      | `/attempts/:id`                                                     | Owner only, no answer key before submission                 |
| PUT      | `/attempts/:id/answer`                                              | `{questionId,version,value,visited,review}`                 |
| POST     | `/attempts/:id/submit`                                              | Atomic, repeat-safe finalization                            |
| GET      | `/attempts/:id/result`, `/attempts/:id/image?key=...`               | Owner's result / signed question image                      |
| GET      | `/reviews`                                                          | Evaluator/admin queue                                       |
| POST     | `/reviews/:id`                                                      | `{questionId,revision,reason,criteria}`; audited            |
| GET/POST | `/admin/academics`, `/admin/questions`, `/admin/tests`              | Editor/admin authoring                                      |
| PATCH    | `/admin/academics/:id`                                              | Name, activation, display order                             |
| PUT      | `/admin/questions/:id`, `/admin/tests/:id`                          | New draft version                                           |
| POST     | `/admin/questions/:id/publish`, `/admin/tests/:id/publish`          | Administrator approval; questions require another author    |
| POST     | `/admin/import/preview`, `/admin/import/confirm`                    | CSV/XLSX preview / validated draft save                     |
| POST     | `/admin/ai-draft`                                                   | Validated AI preview, requires provider configuration       |
| GET      | `/admin/import-template`, `/admin/export`                           | CSV template/export                                         |
| GET      | `/admin/users`                                                      | Administrator account list                                  |
| PATCH    | `/admin/users/:id`                                                  | Super administrator changes roles/activation                |
| GET      | `/admin/audit`                                                      | Super administrator audit events                            |
| GET/POST | `/billing`, `/billing/order`, `/billing/verify`                     | Current pass, checkout order, captured-payment verification |
| POST     | `/billing/webhook`                                                  | Raw-body HMAC verification, provider-signed events          |

Question imports use one `question_json` column. Preview checks shape, academic references and duplicates. Confirm revalidates instead of trusting the preview and reports each saved/failed row. AI drafting uses the same question schema; it cannot bypass publication.

## Client-readiness additions

- `PATCH /auth/me`: update name, language and class/stream (finish active attempts before changing academic scope).
- `POST /auth/otp/request`: `{phone,purpose:LOGIN|LINK}`. Linking requires authentication; phone numbers use international format.
- `POST /auth/otp/check`: `{challengeId,code,client:WEB|MOBILE}`. Provider approval, attempt/expiry checks and one-use consumption are required.
- `GET /announcements`, `GET /resources`: scoped student notices and official-reference metadata.
- `POST /admin/academics/:id/verify`: different administrator verifies the latest academic source.
- `GET/POST /admin/patterns`, `PUT /admin/patterns/:id`, `POST /admin/patterns/:id/publish`: versioned, independently approved subject/session patterns.
- `GET/POST /admin/announcements`, `PUT /admin/announcements/:id`: scheduled/class/stream-scoped notices.
- `GET/POST /admin/plans`, `PATCH /admin/plans/:id`: create immutable pricing terms and activate/deactivate availability.
- `GET /admin/operations`: queue/backlog/readiness counters, without secrets.
- `POST /admin/question-image`: validated multipart image upload; replaces direct unvalidated presigned author uploads.
- `POST /attempts/:id/sheets`: multipart `file` plus `questionId`; active, owned, descriptive question only.
- `GET /attachments/:id`: short-lived private image URL and available transcription for owner/evaluator.
- Answer saves also accept `attachmentIds` (up to four). The response optionally includes objective practice feedback.
- `POST /attempts/:id/retry`: `{filter:INCORRECT|UNANSWERED,feedbackMode:IMMEDIATE|AFTER_SUBMISSION}`.
- `GET /billing/plans`: available class/stream-scoped plans.
- `POST /billing/order`: now requires `{planId}`; the price/duration are server-owned plan terms.
- `POST /billing/subscriptions`: `{planId}` creates recurring checkout after matching the provider plan.
- `POST /billing/subscriptions/verify`: `{subscriptionId,paymentId,signature}`; uses subscription HMAC, captured payment and matching invoice.
- `POST /billing/subscriptions/:id/cancel`: cancel renewal while preserving already-paid access.

The signed raw-body webhook also handles subscription status/charges and full-refund access revocation. Invalid signatures cannot mutate grants. Repeated verification never extends the same grant.
