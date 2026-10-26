# AI evaluation

Only typed short/long answers use AI. The service sends the snapshotted question, reference, accepted alternatives, marks, rubric and student answer to a server-configured provider. Student text is delimited as JSON data and the system prompt rejects instructions in student/source content. Prompt isolation cannot guarantee model correctness: schema validation, bounded scores and human review remain required.

Every rubric ID must appear exactly once. Unknown fields, negative marks, criterion overflows, missing/duplicate criteria and invalid rounding are rejected. The application computes the total rather than accepting a model-supplied total. Current score increments are 0.5. Low confidence (<0.8), provider errors and invalid output lead to REVIEW with null marks. The provider is attempted at most twice; missing configuration goes directly to review. A model confidence value is an uncalibrated self-estimate, not a statistical guarantee.

Jobs and leases are persisted in MongoDB. Each tick finalizes expired attempts and claims one answer job. A 150-second lease recovers after crashes. Writes use a document revision so a worker cannot overwrite a simultaneous human review. Results remain provisional while any answer is pending or requires review; provisional marks exclude those answers.

Evaluators enter criterion marks and a reason. The same arithmetic validator runs on human input. Actor, timestamp, previous evaluation and reason are retained in the attempt history, with an administrative audit event. Language rules must be encoded in the rubric: different wording alone is not penalized, and grammar is assessed only when the question requires it.

AI drafting returns preview JSON only. Saving uses the ordinary question validator and creates DRAFT records; another administrator must approve before publication. Original drafts must not be represented as official previous-year questions. No official BSEB exam data is generated or guessed.

Before activation, approve provider data-processing terms and benchmark Hindi/English answers with teachers across subjects and score bands. No real provider call or calibration is implied by passing local schema tests. OCR, uploaded handwritten answer sheets and diagram recognition are outside this implementation.
