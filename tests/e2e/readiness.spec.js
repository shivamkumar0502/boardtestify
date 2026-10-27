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
    page.getByRole("heading", { name: "अगला अभ्यास चुनें." }),
  ).toBeVisible();
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
