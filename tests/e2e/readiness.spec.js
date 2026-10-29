import { test, expect } from "@playwright/test";
test("Hindi registration and dashboard work without translating stored enum values", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Change language" }).click();
  await page
    .getByRole("link", { name: "अभ्यास शुरू करें", exact: true })
    .click();
  await page.getByLabel("पूरा नाम").fill("बिहार विद्यार्थी");
  await page
    .getByLabel("ईमेल पता")
    .fill(`hindi-${info.project.name}@example.com`);
  await page
    .getByLabel("पासवर्ड", { exact: true })
    .fill("Hindi-student-password-123");
  await page.getByRole("button", { name: "खाता बनाएँ", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /तैयारी आगे बढ़ाएँ/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "टेस्ट देखें", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "BSEB टेस्ट सीरीज़." }),
  ).toBeVisible();
  await page
    .locator(".test-card")
    .filter({ hasText: "Mathematics · sample practice" })
    .getByRole("button", { name: "टेस्ट देखें", exact: true })
    .click();
  await page
    .locator(".test-card")
    .filter({ hasText: "Getting started · sample practice" })
    .getByRole("button", { name: "टेस्ट शुरू करें", exact: true })
    .click();
  await expect(page.getByText("सभी उत्तर सुरक्षित हैं")).toBeVisible();
  await page.screenshot({
    path: info.outputPath("hindi-exam.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
async function login(page, email) {
  // Independent browser actors avoid consuming one account's real login quota.
  if (page.viewportSize()?.width < 600)
    email = email.replace("@fixture.example", "-mobile@fixture.example");
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Fixture-admin-password-123");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: /Let’s make progress/ }),
  ).toBeVisible();
  await page.goto("/app/admin");
  await expect(
    page.getByRole("heading", { name: "Question bank", exact: true }),
  ).toBeVisible();
}
test("staff use visual authoring, a second reviewer approves, and a test is built without JSON", async ({
  page,
}, info) => {
  const question = `Original visual MCQ ${info.project.name}: 2 + 3 = ?`;
  await login(page, "author@fixture.example");
  await page
    .getByRole("button", { name: "Create question", exact: true })
    .click();
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption({ label: "Mathematics · sample practice" });
  await page
    .getByRole("textbox", { name: "Question text", exact: true })
    .fill(question);
  await page.getByLabel("Option 1 text").fill("4");
  await page.getByLabel("Option 2 text").fill("5");
  await page.getByLabel("Correct option 2").check();
  await page
    .getByRole("button", { name: "Validate & save draft", exact: true })
    .click();
  await expect(
    page.getByText("Saved as draft.", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("authoring.png"),
    fullPage: true,
  });
  const own = page.locator(".admin-row").filter({ hasText: question });
  await own.getByRole("button", { name: "Approve & publish" }).click();
  await expect(
    page.getByText("Another administrator must review this question", {
      exact: true,
    }),
  ).toBeVisible();
  await page.request.post("/api/auth/logout", { data: {} });
  await login(page, "reviewer@fixture.example");
  const row = page.locator(".admin-row").filter({ hasText: question });
  await row.getByRole("button", { name: "Approve & publish" }).click();
  await expect(row.getByText(/PUBLISHED/)).toBeVisible();
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await page.getByRole("button", { name: "Create test", exact: true }).click();
  const title = `Visual authored test ${info.project.name}`;
  await page.getByLabel("Test title", { exact: true }).fill(title);
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption({ label: "Mathematics · sample practice" });
  await page
    .locator("label.question-checkbox")
    .filter({ hasText: question })
    .locator("input[type=checkbox]")
    .check();
  await page
    .getByRole("button", { name: "Validate & save draft", exact: true })
    .click();
  await expect(
    page.getByText("Saved as draft.", { exact: true }),
  ).toBeVisible();
  const testRow = page.locator(".admin-row").filter({ hasText: title });
  await testRow.getByRole("button", { name: "Approve & publish" }).click();
  await expect(testRow.getByText(/PUBLISHED/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("staff see release configuration gaps without exposing service keys", async ({
  page,
}, info) => {
  await login(page, "author@fixture.example");
  await page.getByRole("button", { name: "Operations", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Release readiness" }),
  ).toBeVisible();
  await expect(
    page.getByText("Missing configuration: AI_API_KEY"),
  ).toBeVisible();
  await expect(
    page.getByText("PDF answer sheets", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("release-readiness.png"),
    fullPage: true,
  });
});

test("administrator imports original test drafts from the pack library without a terminal", async ({
  page,
}) => {
  await login(page, "reviewer@fixture.example");
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Add practice tests" }),
  ).toBeVisible();
  const card = page.locator(".admin-row").filter({
    has: page.getByRole("heading", {
      name: "Original academic practice pack",
      exact: true,
    }),
  });
  await card.getByRole("button", { name: "Import draft pack" }).click();
  await expect(
    page.getByText(
      "Pack ready: 8 tests, 80 questions. Review drafts before publication.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Mathematics · Linear equations · original practice",
      exact: true,
    }),
  ).toBeVisible();
  await card.getByRole("button", { name: "Import draft pack" }).click();
  await expect(
    page.getByText(
      "Pack ready: 8 tests, 80 questions. Review drafts before publication.",
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Mathematics · Linear equations · original practice",
      exact: true,
    }),
  ).toHaveCount(1);
});

test("staff turn pasted questions into an editable draft test without JSON", async ({
  page,
}, info) => {
  await login(page, "author@fixture.example");
  await page
    .getByRole("button", {
      name: "Create test from photo or text",
      exact: true,
    })
    .click();
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption({ label: "Mathematics · sample practice" });
  await page.getByLabel("Source / book name").fill("Owned worksheet fixture");
  await page
    .getByLabel("Paste question text")
    .fill("1. Evaluate 4 + 5.\nA) 8\nB) 9\nC) 10\nD) 11\nAnswer: B");
  await page
    .getByRole("button", { name: "Format questions", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Question text", exact: true }),
  ).toHaveValue("Evaluate 4 + 5.");
  await page
    .getByLabel("Test title", { exact: true })
    .fill(`Worksheet draft ${info.project.name}`);
  await page.screenshot({
    path: info.outputPath("question-review.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Save draft test", exact: true })
    .click();
  await expect(
    page.getByText(
      "Saved as draft. Review and publish the questions before publishing the test.",
      { exact: true },
    ),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open test drafts", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: `Worksheet draft ${info.project.name}`,
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("simple-import.png"),
    fullPage: true,
  });
});

test("manual test validation asks for subject and questions without raw JSON errors", async ({
  page,
}) => {
  await login(page, "author@fixture.example");
  await page.getByRole("button", { name: "Tests", exact: true }).click();
  await page.getByRole("button", { name: "Create test", exact: true }).click();
  await page
    .getByRole("button", { name: "Validate & save draft", exact: true })
    .click();
  await expect(
    page.getByText("Choose a subject before saving.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption({ label: "Mathematics · sample practice" });
  await page
    .getByRole("button", { name: "Validate & save draft", exact: true })
    .click();
  await expect(
    page.getByText(
      "Add at least one question to every section before saving.",
      { exact: true },
    ),
  ).toBeVisible();
});

test("empty academic selection supports BSEB setup and inline custom subject/chapter", async ({
  page,
}, info) => {
  await login(page, "author@fixture.example");
  await page
    .getByRole("button", {
      name: "Create test from photo or text",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Academic session", { exact: true })
    .fill(info.project.name === "desktop" ? "2030-31" : "2031-32");
  await expect(
    page.getByText(
      "No subjects exist for this session, class and stream. Add them below to continue.",
    ),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Set up BSEB subjects & paper layouts",
      exact: true,
    })
    .click();
  await expect(
    page
      .getByRole("combobox", { name: "Subject", exact: true })
      .locator("option", { hasText: /^Science$/ }),
  ).toHaveCount(1);
  await page
    .getByRole("button", { name: "+ Add subject", exact: true })
    .click();
  await page
    .getByLabel("New subject name", { exact: true })
    .fill("Teacher's custom subject");
  await page
    .getByRole("button", { name: "Save and select", exact: true })
    .click();
  await expect(
    page
      .getByRole("combobox", { name: "Subject", exact: true })
      .locator("option:checked"),
  ).toHaveText("Teacher's custom subject");
  await page
    .getByRole("button", { name: "+ Add chapter", exact: true })
    .click();
  await page
    .getByLabel("New chapter name", { exact: true })
    .fill("Teacher's chapter one");
  await page
    .getByRole("button", { name: "Save and select", exact: true })
    .click();
  await expect(
    page
      .getByRole("combobox", { name: "Chapter", exact: true })
      .locator("option:checked"),
  ).toHaveText("Teacher's chapter one");
  await page
    .getByLabel("Topic", { exact: true })
    .fill("Topic entered by staff");
  await page.screenshot({
    path: info.outputPath("inline-academic-setup.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("real local photo OCR works without paid provider and produces editable MCQs", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  await login(page, "author@fixture.example");
  await page
    .getByRole("button", {
      name: "Create test from photo or text",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Book photo", exact: true }).click();
  const hindi = info.project.name === "mobile-web";
  if (hindi)
    await page
      .getByRole("combobox", { name: "Question language", exact: true })
      .selectOption("hi");
  const png = await page.evaluate(async (hindi) => {
    if (hindi) await document.fonts.load("48px 'Noto Sans Devanagari'");
    const canvas = document.createElement("canvas");
    canvas.width = 1400;
    canvas.height = 800;
    const c = canvas.getContext("2d");
    c.fillStyle = "white";
    c.fillRect(0, 0, 1400, 800);
    c.fillStyle = "black";
    c.font = hindi ? "48px 'Noto Sans Devanagari'" : "48px Arial";
    (hindi
      ? [
          "1. भारत की राजधानी क्या है?",
          "A) Delhi",
          "B) Patna",
          "C) Ranchi",
          "D) Jaipur",
        ]
      : ["1. What is 2 + 3?", "A) Four", "B) Five", "C) Six", "D) Seven"]
    ).forEach((line, i) => c.fillText(line, 80, 110 + i * 110));
    c.font = "30px Arial";
    c.fillText("UNRELATED COLUMN", 980, 110);
    c.fillText("Do not import this text", 980, 200);
    // Sideways, two-column page: exercise actual rotation + selected-area OCR.
    const sideways = document.createElement("canvas");
    sideways.width = canvas.height;
    sideways.height = canvas.width;
    const rotated = sideways.getContext("2d");
    rotated.translate(sideways.width, 0);
    rotated.rotate(Math.PI / 2);
    rotated.drawImage(canvas, 0, 0);
    return sideways.toDataURL("image/png").split(",")[1];
  }, hindi);
  const external = [];
  page.on("request", (req) => {
    if (
      !req.url().startsWith("http://127.0.0.1:4173") &&
      /^https?:/.test(req.url())
    )
      external.push(req.url());
  });
  await page.getByLabel("Book page photo", { exact: true }).setInputFiles({
    name: "printed.png",
    mimeType: "image/png",
    buffer: Buffer.from(png, "base64"),
  });
  await page.getByRole("button", { name: "Rotate left", exact: true }).click();
  const preview = page.getByRole("group", { name: "Photo crop preview" });
  await expect(preview).toHaveAttribute("aria-busy", "false");
  await preview.scrollIntoViewIfNeeded();
  const box = await preview.boundingBox();
  await page.mouse.move(box.x + box.width * 0.02, box.y + box.height * 0.05);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.85, {
    steps: 5,
  });
  await page.mouse.up();
  await expect(preview).not.toHaveAttribute("data-selection-width", "1");
  await page
    .getByRole("button", { name: "Read photo for free", exact: true })
    .click();
  await expect(page.getByLabel("Paste question text")).toHaveValue(
    hindi ? /भारत/ : /What is 2 \+ 3/,
    { timeout: 60000 },
  );
  await expect(page.getByLabel("Paste question text")).not.toHaveValue(
    /UNRELATED COLUMN/,
  );
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption({ label: "Mathematics · sample practice" });
  await page.getByLabel("Source / book name").fill("Printed local OCR fixture");
  if (hindi) {
    const extracted = await page.getByLabel("Paste question text").inputValue();
    // The real Hindi OCR sometimes reads the printed 1. as L.; staff corrects it.
    await page
      .getByLabel("Paste question text")
      .fill(extracted.replace(/^[LIil][.]\s*/, "1. "));
  }
  await page
    .getByRole("button", { name: "Format questions", exact: true })
    .click();
  await expect(
    page.getByRole("textbox", { name: "Question text", exact: true }),
  ).toHaveValue(hindi ? /भारत/ : /What is 2 \+ 3/, { timeout: 20000 });
  await expect(
    page.getByRole("textbox", { name: "Option 2", exact: true }),
  ).toHaveValue(hindi ? "Patna" : "Five");
  await expect(
    page.getByRole("combobox", { name: "Correct answer", exact: true }),
  ).toHaveValue("");
  await page
    .getByRole("combobox", { name: "Correct answer", exact: true })
    .selectOption(hindi ? "a" : "b");
  await page
    .getByRole("textbox", { name: "Question text", exact: true })
    .fill(hindi ? "भारत की राजधानी क्या है?" : "What is 2 + 3?");
  expect(external).toEqual([]);
  await page.screenshot({
    path: info.outputPath("real-photo-ocr-review.png"),
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("administrator imports actual starter questions, reviews a test and starts it from the series", async ({
  page,
}, info) => {
  const science = info.project.name === "mobile-web";
  const title = science
    ? /^Electricity · Practice 01/
    : /^Grammar & vocabulary · Practice 01/;
  const question = science
    ? "An ohmic resistor is 3 Ω across 6 V. Current in amperes?"
    : "Choose: She ___ to school every day.";
  await login(page, "author@fixture.example");
  await page.goto("/app/tests");
  await page
    .getByRole("link", { name: "Add actual tests", exact: true })
    .click();
  await page
    .locator(".admin-row")
    .filter({
      has: page.getByRole("heading", {
        name: "Class 10 · six-subject starter + full Maths mock",
        exact: true,
      }),
    })
    .getByRole("button", { name: "Import actual tests & review", exact: true })
    .click();
  const review = page.getByRole("region", {
    name: "Review starter tests",
    exact: true,
  });
  await expect(
    review.getByRole("heading", { name: "Review questions, then publish" }),
  ).toBeVisible();
  await review.getByRole("button", { name: title }).click();
  await expect(review.getByText(question, { exact: true })).toBeVisible();
  await expect(
    review.getByRole("button", {
      name: "Publish this test for students",
      exact: true,
    }),
  ).toBeDisabled();
  await review
    .getByRole("checkbox", {
      name: "I reviewed all questions, answer keys and marking shown for this test.",
      exact: true,
    })
    .check();
  await review
    .getByRole("button", {
      name: "Publish this test for students",
      exact: true,
    })
    .click();
  await expect(
    review.getByText("Published. Students can now start this test.", {
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/app/tests");
  const card = page
    .locator(".test-card")
    .filter({
      has: page.getByRole("heading", {
        name: science ? "Science" : "English",
        exact: true,
      }),
    })
    .filter({ hasText: "2026-27" });
  await expect(
    card.getByText("1 tests · 1 free", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: info.outputPath("published-starter-series.png"),
    fullPage: true,
  });
  await card.getByRole("button", { name: "View tests", exact: true }).click();
  await page.getByRole("button", { name: "Start test", exact: true }).click();
  await expect(page.getByText(question, { exact: true })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(4);
});

test("Class 12 stream packs publish real questions and appear for the matching student", async ({
  page,
}, info) => {
  test.setTimeout(90000);
  const science = info.project.name === "desktop",
    stream = science ? "SCIENCE" : "ARTS",
    packId = `class12-${stream.toLowerCase()}-starter`;
  await login(page, "reviewer@fixture.example");
  await page.goto(`/app/admin?tab=Tests&pack=${packId}`);
  await page
    .locator(".admin-row")
    .filter({
      has: page.getByRole("heading", {
        name: new RegExp(`^Class 12 ${stream} · six-subject starter`),
      }),
    })
    .getByRole("button", { name: "Import actual tests & review", exact: true })
    .click();
  const review = page.getByRole("region", {
    name: "Review starter tests",
    exact: true,
  });
  await review
    .getByRole("button", {
      name: science
        ? /^Physics · Full mock 01/
        : /^Indian national movement · Practice 01/,
    })
    .click();
  if (science) {
    await expect(
      review.getByText(
        "Full mock: 70 theory marks · 195 min total · 15 min reading",
        { exact: true },
      ),
    ).toBeVisible();
    while (
      await review
        .getByRole("button", {
          name: "Show next questions for review",
          exact: true,
        })
        .count()
    )
      await review
        .getByRole("button", {
          name: "Show next questions for review",
          exact: true,
        })
        .click();
  }
  await review
    .getByRole("checkbox", {
      name: "I reviewed all questions, answer keys and marking shown for this test.",
      exact: true,
    })
    .check();
  await review
    .getByRole("button", {
      name: "Publish this test for students",
      exact: true,
    })
    .click();
  await expect(
    review.getByText("Published. Students can now start this test.", {
      exact: true,
    }),
  ).toBeVisible();
  const context = await page
    .context()
    .browser()
    .newContext({ viewport: page.viewportSize() });
  try {
    const student = await context.newPage();
    await student.goto("http://127.0.0.1:4173/register");
    await student.getByLabel("Full name").fill("Class Twelve Student");
    await student
      .getByLabel("Email address")
      .fill(`twelve-${info.project.name}@fixture.example`);
    await student
      .getByLabel("Password", { exact: true })
      .fill("Class-twelve-password-123");
    await student
      .getByRole("combobox", { name: "Class", exact: true })
      .selectOption("12");
    await student
      .getByRole("combobox", { name: "Stream", exact: true })
      .selectOption(stream);
    await student
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await student
      .getByRole("link", { name: "Explore tests", exact: true })
      .click();
    const card = student
      .locator(".test-card")
      .filter({ hasText: "2026-27" })
      .filter({
        has: student.getByRole("heading", {
          name: science ? "Physics" : "History",
          exact: true,
        }),
      });
    await expect(
      card.getByText("1 tests · 1 free", { exact: true }),
    ).toBeVisible();
    await card.getByRole("button", { name: "View tests", exact: true }).click();
    await student.screenshot({
      path: info.outputPath("class12-published-tests.png"),
      fullPage: true,
    });
    await student
      .getByRole("button", { name: "Start test", exact: true })
      .click();
    await expect(student.getByRole("radio")).toHaveCount(4);
    if (science)
      await expect(student.getByText(/Reading time/).first()).toBeVisible();
  } finally {
    await context.close();
  }
});

test("local photo reader reports missing worker assets and allows retry without metadata", async ({
  page,
}) => {
  await login(page, "reviewer@fixture.example");
  await page
    .getByRole("button", {
      name: "Create test from photo or text",
      exact: true,
    })
    .click();
  await page.getByRole("button", { name: "Book photo", exact: true }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 400;
    c.height = 200;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = "black";
    ctx.font = "32px Arial";
    ctx.fillText("1. Test question?", 20, 60);
    return c.toDataURL("image/png").split(",")[1];
  });
  await page
    .getByLabel("Book page photo", { exact: true })
    .setInputFiles({
      name: "asset-error.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  await page.route("**/ocr/worker.min.js", (route) => route.abort());
  const read = page.getByRole("button", {
    name: "Read photo for free",
    exact: true,
  });
  await read.click();
  await expect(
    page.getByText(
      "Photo reader failed. Reload and retry a smaller, upright crop.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 15000 });
  await expect(read).toBeEnabled();
  await expect(page.getByLabel("Paste question text")).toHaveCount(0);
});
