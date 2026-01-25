/**
 * Settings page smoke test
 *
 * Verifies that the settings page loads and displays tabs.
 */

import { expect, test } from "@playwright/test";

test.describe("Settings Smoke Tests", () => {
  test.setTimeout(30000);

  test("settings page loads with tabs", async ({ page }) => {
    await page.goto("/settings");
    await page.waitForLoadState("networkidle");

    // Should be on settings page
    await expect(page).toHaveURL(/\/settings/);

    // Settings header should be visible
    await expect(page.locator('[data-component="settings-page"]')).toBeVisible({
      timeout: 15000,
    });

    // Tab navigation should be visible with General tab
    await expect(page.locator('[data-tab="general"]')).toBeVisible();
  });
});
