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
| POST     | `/uploads`                                                          | Staff-only constrained presigned S3 POST                    |
| GET/POST | `/billing`, `/billing/order`, `/billing/verify`                     | Current pass, checkout order, captured-payment verification |
| POST     | `/billing/webhook`                                                  | Raw-body HMAC verification, provider-signed events          |

Question imports use one `question_json` column. Preview checks shape, academic references and duplicates. Confirm revalidates instead of trusting the preview and reports each saved/failed row. AI drafting uses the same question schema; it cannot bypass publication.
