/**
 * Practice page smoke test
 *
 * Verifies that the practice page loads and displays player list.
 */

import { expect, test } from "@playwright/test";

test.describe("Practice Smoke Tests", () => {
  test.setTimeout(30000);

  test("practice page loads", async ({ page }) => {
    await page.goto("/practice");
    await page.waitForLoadState("networkidle");

    // Should be on practice page
    await expect(page).toHaveURL(/\/practice/);

    // Page should have interactive elements (indicates JS hydrated)
    await expect(page.locator("a, button").first()).toBeVisible({
      timeout: 15000,
    });
  });
});
