/**
 * Arcade smoke test
 *
 * Verifies that the arcade/games pages load and render interactive content.
 */

import { expect, test } from "@playwright/test";

test.describe("Arcade Smoke Tests", () => {
  test.setTimeout(30000);

  test("games page loads and shows game content", async ({ page }) => {
    await page.goto("/games");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/games/);

    // Page should have interactive elements
    await expect(page.locator("button, a, [role='button']").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("arcade page loads", async ({ page }) => {
    await page.goto("/arcade");
    await page.waitForLoadState("networkidle");

    // Should have interactive content
    await expect(page.locator("button, a, [role='button']").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("Memory Pairs game loads", async ({ page }) => {
    await page.goto("/games/matching");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/games\/matching/);

    // Should have interactive content
    await expect(page.locator("button, a, [role='button']").first()).toBeVisible({
      timeout: 15000,
    });
  });
});
