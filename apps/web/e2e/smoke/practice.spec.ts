/**
 * Practice page smoke test
 *
 * Verifies that practice/create pages load correctly.
 */

import { expect, test } from "@playwright/test";

test.describe("Practice Smoke Tests", () => {
  test.setTimeout(30000);

  test("create page loads", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/create/);

    // Should have interactive content
    await expect(page.locator("button, a, input, select").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("worksheets page loads", async ({ page }) => {
    await page.goto("/create/worksheets");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/create\/worksheets/);

    // Should have interactive content
    await expect(page.locator("button, a, input, select").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("flashcards page loads", async ({ page }) => {
    await page.goto("/create/flashcards");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/create\/flashcards/);

    // Should have interactive content
    await expect(page.locator("button, a, input, select").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("can navigate within create section", async ({ page }) => {
    await page.goto("/create");
    await page.waitForLoadState("networkidle");

    // Should have links
    await expect(page.locator("button, a").first()).toBeVisible({
      timeout: 15000,
    });

    const links = page.locator("a");
    const count = await links.count();
    expect(count).toBeGreaterThan(0);
  });
});
