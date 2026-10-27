# Validation evidence

Local checks on 27 October 2026. These results concern the repository source and disposable test fixtures, not an activated production deployment.

| Check                                                        | Result                     |
| ------------------------------------------------------------ | -------------------------- |
| JavaScript syntax and no TypeScript source (`npm run check`) | Pass                       |
| Domain/scoring/locale tests (`npm test`)                     | 16 passed                  |
| MongoDB/API integration (`npm run test:integration`)         | 9 passed                   |
| React production build                                       | Pass                       |
| Expo Android JS/Hermes bundle export                         | Pass; not a signed APK/AAB |

Browser acceptance: 8 tests passed across desktop Chrome and Pixel 5 mobile-web emulation. They cover Hindi registration/dashboard/exam, visual question creation, blocked self-approval, second-reviewer publication, visual test creation, persisted/reloaded answers, submission/results and narrow-screen layout. Hindi fonts are bundled with the website, including offline exam use.

Integration coverage includes authorization, independent publication, source-backed pattern validation, private image validation, OCR/vision review fallback, one-use OTP challenges, captured one-time/recurring payments, cancellation/full refunds/replay, reading time, internal choices, concurrent answer conflicts, shared rate windows, overload gates, fenced evaluation lease recovery and database outage/reconnect without loss of saved answers. External paid providers use controlled adapter responses; no live charge/SMS or provider acceptance claim follows from those tests.

## Synthetic exam load

Command: `LOAD_STUDENTS=100 LOAD_CONCURRENCY=50 npm run test:load`.

The isolated benchmark uses a local disposable MongoDB, two HTTP listeners in **one Node process**, ten objective questions per exam, and authenticated synthetic students. It excludes password hashing, large question sheets, external AI/OCR/payments and distributed-host/network effects.

| Measurement                                           | Observed                                 |
| ----------------------------------------------------- | ---------------------------------------- |
| Students / concurrent student flows                   | 100 / 50                                 |
| Requests                                              | 1,200                                    |
| Duration / request rate                               | 7.94 seconds / 151.2 requests per second |
| Request latency p50 / p95                             | 272.6 ms / 679.2 ms                      |
| Maximum event-loop delay                              | 190.6 ms                                 |
| Attempts with every expected answer and correct score | 100                                      |
| Request/data-integrity errors                         | 0                                        |

Other test/build activity ran on the local environment. These measurements are reproducible diagnostics, not a promised concurrent-student limit. Run representative staging load/soak tests on the actual API, database and provider plans before publishing capacity figures.

## Release acceptance still required

- Client-owned current academic content, source approval and teacher-labelled AI calibration.
- Real SMTP, private object storage, OCR/AI, optional Twilio and Razorpay sandbox acceptance; only then authorized live activation.
- Physical Android testing, signing/store acceptance, staging soak, production monitoring and backup/restore exercise.

See `CLIENT_HANDOFF.md` for the activation and academic workflow. Handwritten/diagram marks always remain provisional until human review.
