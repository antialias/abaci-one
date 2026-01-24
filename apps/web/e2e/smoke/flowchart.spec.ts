/**
 * Flowchart smoke test
 *
 * Verifies that the flowchart viewer and guide pages load correctly.
 */

import { expect, test } from "@playwright/test";

test.describe("Flowchart Smoke Tests", () => {
  test.setTimeout(30000);

  test("flowchart page loads", async ({ page }) => {
    await page.goto("/flowchart");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/flowchart/);

    // Should have interactive content
    await expect(page.locator("button, a, svg, [role]").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("guide page loads", async ({ page }) => {
    await page.goto("/guide");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/guide/);

    // Should have content
    await expect(page.locator("button, a, h1, h2, h3").first()).toBeVisible({
      timeout: 15000,
    });
  });

  test("guide page has navigation content", async ({ page }) => {
    await page.goto("/guide");
    await page.waitForLoadState("networkidle");

    // Should have interactive elements
    await expect(page.locator("button, a").first()).toBeVisible({
      timeout: 15000,
    });

    const interactiveElements = page.locator("a, button");
    const count = await interactiveElements.count();
    expect(count).toBeGreaterThan(0);
  });
});
