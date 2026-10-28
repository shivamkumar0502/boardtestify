# Answer evaluation

Typed short/long answers use the configured reference, accepted alternatives, subject-specific rubric, maximum marks and language. The prompt accepts conceptual equivalence and does not make grammar a major factor unless the rubric assesses language. Every criterion ID must appear once. Negative/overflow/missing/duplicate marks and invalid scoring increments are rejected; the application computes totals. Questions configure whole, half or quarter mark increments. Provider output/feedback size and request time are bounded.

A nonempty answer with an unavailable/invalid model response receives REVIEW with null marks, never an automatic zero. Low model confidence is a review signal, not a calibrated probability. The service retries validation at most twice and has a short provider-outage circuit breaker.

Students can upload up to four private image pages for a descriptive answer. The API checks ownership, question membership, active attempt/deadline, file size, actual image format and pixel bounds, then strips metadata/re-encodes the image. Attachment IDs are saved with the answer under the same optimistic revision rules as text. A page alone counts as an answer. OCR and grading occur after submission in a durable leased worker.

Google Vision DOCUMENT_TEXT_DETECTION extracts Hindi/English handwriting. When `AI_VISION_ENABLED=true`, the original page images accompany OCR text to an image-capable model so it can inspect equations/steps/labels/diagrams. OCR errors/unreadable pages are exposed for teacher review. All handwritten/diagram suggestions remain REVIEW even if the model suggests full marks; only an evaluator can finalize them. Missing image evidence is not hallucinated as a diagram.

Evaluator changes use the same arithmetic validator and a required reason. The attempt keeps five compact review summaries; the administrative audit stores the previous evaluation and full reason. Lease tokens and document revisions prevent stale workers from overwriting reviewed answers. Private images and OCR transcription are available to their owner and authorized evaluators.

AI drafting returns a preview and forces an unverified original-draft source label. Saving uses ordinary validation and DRAFT status, and another administrator must approve questions. It cannot label generated content an official PYQ automatically.

Use the teacher-labelled calibration runner described in CLIENT_HANDOFF.md. Local provider-contract tests are not a Hindi handwriting accuracy study or official BSEB grading certification.
