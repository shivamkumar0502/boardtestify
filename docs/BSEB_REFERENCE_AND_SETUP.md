# BSEB series, academic setup and free photo reading

## What changed

The academic picker now queries the selected session/class/stream instead of relying on the first 1,000 records from all sessions. When no subjects exist, it explains the empty selection and offers **Set up BSEB subjects & paper layouts**. This idempotently creates missing reference subjects and draft layouts without overwriting teacher edits, existing inactive subjects or published layouts. Staff can also use **+ Add subject**, **+ Add chapter** and a free-text topic directly in the same form. No terminal, syllabus seed or JSON is required. Chapters/topics are staff-owned; no complete or current syllabus is claimed.

A draft layout can be selected while constructing a draft board mock. The bank must contain the correct numbers/types/marks of approved questions. A different administrator still has to approve the layout and questions before publishing a board mock. Selecting a template does not fabricate a complete question paper.

## Reference year and subject scheme

Reference metadata was checked on **28 October 2026** against BSEB's **2026 model papers**. It is labelled 2026 even when installed into another academic session. It is not a verified 2027 pattern. Before publishing for another examination year, independently review the new notice/model paper and edit/approve the layout.

- Class X: first language (MIL), second language (SIL), Mathematics, Science and Social Science form the usual five-subject aggregate of 500 marks. Compulsory English is separate; an additional optional subject may be registered. Listed alternative languages are choices, not additional compulsory subjects. Follow the registration/admit card and current rules for individual cases.
- Class XII: two different languages (200 marks, with Hindi or English as one language) and three electives (300 marks), with an optional additional sixth subject. The catalogue lists choices in Science, Arts and Commerce, not a claim that every listed subject is compulsory or available at every school. Agriculture/vocational streams beyond the existing three app streams remain outside this release.

Official references:

- [Matric model-paper index](https://biharboardonline.com/modelpapermatric.html)
- [Intermediate model-paper index](https://biharboardonline.com/modelpaperinter.html)
- [Intermediate subject-group form](https://inter.biharboardonline.com/pdf/Arts%20Compartmental.pdf)

## Subject-specific layouts

`backend/src/bseb-catalog.js` records the paper URL, reference year, separate theory/other assessment marks, writing/reading time, offered questions, answer limits and marks per response. Negative marking is zero. Full mock answer limits retain the existing first-answered-in-paper-order policy.

| Reference | Offered → answer | Theory / other assessment |
| --- | --- | --- |
| X Mathematics | 100→50 MCQ, 30→15 short ×2, 8→4 long ×5 | 100 / 0 |
| X Science | 80→40 MCQ; short: 8→4 ×2 **each** in Physics/Chemistry/Biology; long: 2→1 **each**, Physics ×6, Chemistry/Biology ×5 | 80 / 20 |
| X Social Science | 80→40 MCQ; short: History 6→3, Political Science 4→2, Economics 4→2, Geography 6→3, Disaster Management 4→2, all ×2; long: 2→1 ×4 each in History/Political Science/Economics/Geography | 80 / 20 |
| XII Physics/Chemistry/Biology, Computer Science and other checked 70-mark papers | 70→35 MCQ, 20→10 short ×2, 6→3 long ×5 | 70 / 30 |
| XII Mathematics, Business Studies, Accountancy, Economics, History, Political Science, Sociology, Philosophy | 100→50 MCQ, 30→15 short ×2, 8→4 long ×5 | 100 / 0 |

For X Hindi/Sanskrit/English and XII Hindi/English, language-specific passage/writing/literature groups replace a generic short/long split. Compound passage questions must retain their subparts and marking rubric. Printed top-level question-group counts differ from individual answer choices: e.g. Hindi X reports 100 MCQs + six descriptive groups, not 138 generic questions. The Science X cover contains a conflicting total; the stored 110 follows the detailed section instructions and actual 80+24+6 structure. Review those instructions, not only the cover total.

Writing time is 180 minutes + 15 reading for the checked 100-mark and XII papers; X Science/Social Science use 150 + 15. Practical/internal/project assessment is never added to a student's online theory score. For alternative-language layouts and Music not yet transcribed in detail, the catalogue links to the official index and explicitly asks staff to enter a reviewed layout; it does not guess question counts or assessment splits.

## Free photo reader

**Book photo → Free printed-text OCR · this device → Read photo for free → correct extracted text → Format questions → edit questions/keys/marks → Save draft test.**

Printed Hindi/English OCR runs in a browser Web Worker using Tesseract.js. The pinned worker, WASM and English/Hindi models are served from the app's own `/ocr/` path; there is no runtime CDN or paid-key requirement. The source image remains on the staff device in this mode. Only corrected text is submitted to the existing authenticated job API when **Format questions** is clicked. The optional cloud mode continues to require configured private storage and OCR/vision credentials, and uploads the photo to those services.

JPEG/PNG/WebP up to 5 MB and 24 million decoded pixels are accepted, then resized to at most 2,200 pixels on the long edge. Crop a single column containing at most ten questions. OCR is cancellable, time-bounded and terminated after use. Printed arithmetic, punctuation, Hindi, handwriting and multi-column ordering can be misread: compare text/options before formatting. Missing keys remain blank. The parser accepts common numbered questions, Devanagari numerals, inline (A)…(D) or (क)…(घ) options and numbered descriptive drafts. Descriptive references/rubrics still require staff input. No handwriting, diagram or general textbook accuracy guarantee follows from the fixture checks.

`frontend/ocr-assets.js` copies pinned npm assets at Vite dev/build startup. Generated assets are ignored by Git and included in the production build/container. Content Security Policy allows same-origin workers and WebAssembly compilation; it does not enable arbitrary JavaScript eval or external OCR downloads. Asset licences remain available alongside the assets.

## Series library

Configured subjects remain visible even before tests are published, with an explicit empty count. Cards show actual published/free counts and reference theory marks. Students can search subjects, select a session, inspect the subject/mark guide, and filter a subject's published tests by full mocks, chapter tests, topic tests or subject practice. Existing mode/search/access/chapter/cursor filters, resume/results and server-side entitlements remain enforced. Publication/class/stream filtering applies to every result; draft questions/keys stay private. This release changes the website; the native app keeps its compatible existing listing.

After merging, run `npm ci` and `npm run migrate`, then `npm run dev`. Production keeps the separate background-worker setup described in `SERIES_AND_QUESTION_IMPORT.md`. No live client database was changed by local checks.
