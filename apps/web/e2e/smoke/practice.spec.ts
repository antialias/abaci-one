/**
 * Practice page smoke test
 *
 * Verifies that practice section is accessible via navigation.
 * Note: Direct navigation to /create pages can timeout due to heavy client-side
 * rendering, so we test via navigation from homepage instead.
 */

import { expect, test } from "@playwright/test";

test.describe("Practice Smoke Tests", () => {
  test.setTimeout(30000);

  test("can navigate to create page", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Find and click create link
    const createLink = page.locator('a[href="/create"]').first();
    await expect(createLink).toBeVisible({ timeout: 5000 });
    await createLink.click();

    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/create/);
  });
});
