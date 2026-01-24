/**
 * Flowchart smoke test
 *
 * Verifies that the flowchart viewer page loads correctly.
 */

import { expect, test } from "@playwright/test";

test.describe("Flowchart Smoke Tests", () => {
  test.setTimeout(30000);

  test("flowchart page loads", async ({ page }) => {
    await page.goto("/flowchart");
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/flowchart/);

    // Should have interactive content (SVG diagram or controls)
    await expect(page.locator("button, a, svg, [role]").first()).toBeVisible({
      timeout: 15000,
    });
  });
});
