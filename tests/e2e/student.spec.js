import { test, expect } from "@playwright/test";
test("student registers, starts a persisted test, reloads, and receives a provisional result", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", {
      name: "Your next chapter. Your best score. Starts here.",
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("link", { name: "Start your preparation" }).click();
  await page.getByLabel("Full name").fill("Bihar Board Student");
  await page
    .getByLabel("Email address")
    .fill(`student-${info.project.name}@example.com`);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Secure-student-password-123");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByRole("heading", { name: /Let’s make progress/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore tests" }).click();
  await page
    .locator(".test-card")
    .filter({ hasText: "Getting started · sample practice" })
    .getByRole("button", { name: "Start test" })
    .click();
  await expect(
    page.getByRole("heading", { name: "If 2x + 3 = 11, what is x?" }),
  ).toBeVisible();
  await page.getByRole("radio").nth(1).check();
  await expect(page.getByText("All answers saved")).toBeVisible();
  const url = page.url();
  await page.reload();
  await expect(page.getByRole("radio").nth(1)).toBeChecked();
  expect(page.url()).toBe(url);
  await page.getByRole("button", { name: "Save & next" }).click();
  await page
    .getByLabel("Write your answer in Hindi or English")
    .fill("Add 6 to both sides: 3x = 15. Divide by 3 to get x = 5.");
  await expect(page.getByText("All answers saved")).toBeVisible();
  await page.getByRole("button", { name: "Submit test", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Submit test", exact: true })
    .click();
  await expect(
    page.getByText("Provisional · evaluation in progress"),
  ).toBeVisible();
  await expect(page.getByText("Correct answer: 4")).toBeVisible();
});
test("landing and sign-in fit narrow screens", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "One board. Every ambition." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Good to see you again." }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
