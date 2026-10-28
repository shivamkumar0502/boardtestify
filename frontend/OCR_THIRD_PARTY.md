# Browser OCR components

The website serves these pinned packages locally; package-lock.json records exact versions and integrity hashes.

- Tesseract.js 7.0.0 — Apache-2.0, https://github.com/naptha/tesseract.js. Full licence: LICENSE-tesseract.txt in this directory.
- Tesseract.js-core (resolved by Tesseract.js) — Apache-2.0, https://github.com/naptha/tesseract.js-core. Full licence: LICENSE-core.txt in this directory.
- @tesseract.js-data/eng 1.0.0 and @tesseract.js-data/hin 1.0.0 — npm package metadata declares MIT, https://github.com/naptha/tessdata. Models originate in the Tesseract language-data project: https://github.com/tesseract-ocr/tessdata_best (Apache-2.0). The Apache licence is supplied above.

Generated /ocr files are copied from the installed packages by frontend/ocr-assets.js and included in the web distribution. They are not uploaded to a CDN by this application.
