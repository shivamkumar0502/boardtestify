# CBT engine

Starting a published test copies the actual selected questions, order, marks, rubrics, language and section rules into an attempt. Editing a question or test later cannot change that attempt. A unique partial index allows one active attempt per student/test. Concurrent starts return the existing attempt; completed attempts may be retried by starting again.

The server records `startedAt` and `deadline`. The client receives `serverNow` and derives its display from a monotonic clock; periodic server sync corrects drift. Offline display is an estimate. Device time cannot extend the server deadline. Requests received after expiry cannot change answers. A database sweep and lazy finalization cover closed tabs and inactive clients.

Answers live in the same document as attempt state. Each answer update supplies its last acknowledged answer version. An atomic update also compares the document revision, active state and unexpired deadline. A conflict returns 409; clients preserve local data and require an explicit discard/reload rather than overwriting a newer answer. Multi-question internal-choice limits are checked under the same document revision.

Web and native clients save queued updates locally and send them sequentially with revision checks. Offline work must reconnect before the deadline to count. Local caches are convenience copies, not an extension to submission time. Keep the screen open until all updates are saved; cross-tab navigation cannot guarantee persistence on every browser. Cache cleanup/retention should be configured for shared devices before launch.

Submission calculates objective marks from the immutable key and creates descriptive jobs in one atomic document transition. Repeating submit does not award marks twice. Answered-and-marked-for-review answers count. Unanswered descriptive questions score zero explicitly; failed evaluation of a nonempty answer never silently scores zero.

Maximum marks are computed per section using its allowed answer count. When internal choices have different question maxima, the displayed maximum is the sum of the largest permitted maxima; use equal-mark alternatives when that is the verified subject pattern. Numerical answers currently accept configured normalized strings; symbolic algebra equivalence requires a separate math adapter.
