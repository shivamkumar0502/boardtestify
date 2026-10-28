# CBT and practice engine

A published test creates a snapshot of its actual selected questions, order, answer keys, marks, rubrics, language, sections and approved pattern version. Later content edits cannot change a started attempt. A partial unique index enforces one active attempt per student/test; repeat starts resume the attempt.

The server controls start/deadline and optional initial reading period, included within total duration. Clients use a server-synchronized monotonic display clock. Refresh/device clock changes cannot extend the deadline. Expiry is finalized lazily on access and by worker sweeps; closing the client cannot keep a test open for answer changes.

Answer updates require the last acknowledged answer version plus a document revision/deadline check. Updates are atomic. The save path projects only the current question/answer, scope and compact tracking data rather than returning the full paper for every keystroke. Local queues preserve unsent work and retry transient failures. Offline work must reach the server before the deadline to count. A stale 409 never overwrites a newer answer; the user resolves it explicitly.

Internal-choice sections either prevent extra answers or score only the first permitted answered questions in paper order. Over-limit answers in the latter mode are NOT_COUNTED. Official board tests must match a separately approved subject/session pattern's duration, counts, marks, types and word limits. Pattern totals are validated in code, and no one-size-fits-all board pattern is assumed.

Submission computes objective marks and creates pending descriptive work in a single attempt transition. Repeating submission does not score twice. Unanswered descriptive answers explicitly receive zero; an uploaded image is not treated as unanswered. Model/OCR failures of nonempty answers require review. Summary fields support lightweight list/analytics queries; migration backfills older records without changing saved answers.

IMMEDIATE feedback is permitted only for PRACTICE and is returned after an objective answer is saved. CBT/BOARD answer keys remain hidden until submission. Incorrect-question retry includes known evaluated mistakes; unanswered retry includes questions with no text/pages. Each retry gets its own untimed practice snapshot and retains the original result.

Question/answer/evaluation sizes are bounded to stay within MongoDB document limits. Maximum marks for arbitrary mixed-mark internal choices are the sum of the largest allowed maxima; verified official patterns require consistent per-section marks. Numerical acceptance currently uses configured normalized strings, not a symbolic algebra engine.
