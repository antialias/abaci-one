/**
 * Homepage smoke test
 *
 * Verifies that the homepage loads correctly and basic navigation works.
 */

import { expect, test } from "@playwright/test";

test.describe("Homepage Smoke Tests", () => {
  test.setTimeout(30000);

  test("homepage loads and displays main content", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Check page title
    await expect(page).toHaveTitle(/Abaci/);

    // Page should have interactive elements (indicates JS hydrated)
    await expect(page.locator("a, button").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("can navigate to games page from homepage", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const gamesLink = page.locator('a[href="/games"], a[href*="/arcade"]').first();
    await expect(gamesLink).toBeVisible({ timeout: 5000 });

    await gamesLink.click();
    await page.waitForURL(/\/(games|arcade)/, { timeout: 10000 });
    expect(page.url()).toMatch(/\/(games|arcade)/);
  });

  test("can navigate to create page from homepage", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const createLink = page.locator('a[href="/create"]').first();
    await expect(createLink).toBeVisible({ timeout: 5000 });

    await createLink.click();
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(/\/create/);
  });
});
