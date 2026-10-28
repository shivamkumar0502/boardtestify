# Source-linked BSEB mini practice pack

Checked 28 October 2026 against BSEB's official 2026 model-paper listings and linked PDFs. This pack contains **five draft mini tests and fifteen adapted bilingual MCQs**, not complete official papers, official answer keys or a verified 2027 pattern. Adapted questions are marked `isPYQ: false`. All keys/explanations are suggested and require teacher review. Questions, translations and distractors may differ from the source.

| Scope             | Subject     | Official 2026 source questions / PDF pages |
| ----------------- | ----------- | ------------------------------------------ |
| Class 10          | Mathematics | Q2 / p3; Q8 / p5; Q9 / p6                  |
| Class 10          | Science     | Q1 / p3; Q2 / p3; Q4 / p4                  |
| Class 12 Science  | Physics     | Q2 / p3; Q3 / p4; Q13 / p7                 |
| Class 12 Arts     | History     | Q2 / p3; Q3 / p4; Q7 / p5                  |
| Class 12 Commerce | Accountancy | Q2 / p3; Q5 / p4; Q29 / p11                |

Each item retains the source PDF URL, page anchor and source year. Full PDF links are available in Official study references; Administration question/test rows now expose a source link for review. The pack's session is **2025–26**, matching the historical paper. Its chosen settings (three questions, ten minutes, one mark each, immediate feedback) are practice settings, not official full-exam timing/distribution. No unverified chapter names are created.

Sources:

- [Official Matric listing](https://biharboardonline.com/modelpapermatric.html)
- [Official Intermediate listing](https://biharboardonline.com/modelpaperinter.html)
- [Mathematics](https://biharboardonline.com/files/MatricModelPaper/2026/110_Math.pdf)
- [Science](https://biharboardonline.com/files/MatricModelPaper/2026/112_Science.pdf)
- [Physics](https://biharboardonline.com/files/InterModelPaper/2026/117_Physics.pdf)
- [History](https://biharboardonline.com/files/InterModelPaper/2026/321_History.pdf)
- [Accountancy](https://biharboardonline.com/files/InterModelPaper/2026/220_Accountancy.pdf)

## Add to your database

After pulling this change, stop old API processes and run from the repository root with the intended root `.env` configured:

```bash
npm run migrate
npm run seed:bseb
npm run dev
```

The ordinary `npm run seed` also includes this draft pack alongside the existing demo. Both commands use insert-only updates for the pack. Re-running them does not duplicate questions/tests, overwrite teacher edits, reset published records, alter subscriptions or delete student data. Stable deterministic test identifiers use MongoDB’s existing primary-key uniqueness; no new schema migration is needed for this pack. The migration command ensures the existing platform indexes without dropping collections.

## Review and publish

1. Sign in as administrator. In **Questions**, open each source PDF at the recorded page and check the adapted English/Hindi text, options, suggested answer and explanation. Edit where needed.
2. Approve/publish questions using the existing independent-review workflow. If a staff editor changes a question, another administrator must approve that latest version.
3. In **Tests**, review the corresponding `BSEB 2026 source-based mini practice` draft and publish only after its three questions are approved.
4. Students in the matching class/stream can then start it. Before publication the draft is absent from student test lists and cannot be started.

The importer does not auto-approve academic sources or publish AI-authored suggested keys. Current-session syllabus and full-length board papers still require separate academic review. This change imports content only when the operator runs the command; no client database was accessed during development.
