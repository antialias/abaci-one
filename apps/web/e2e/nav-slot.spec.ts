import { expect, test } from "@playwright/test";

test.describe("Game navigation slots", () => {
  test("should show Memory Pairs game name in nav when navigating to matching game", async ({
    page,
  }) => {
    await page.goto("/games/matching");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Look for the game name in the navigation
    const gameNav = page.locator(
      '[data-testid="nav-slot"], h1:has-text("Memory Pairs")',
    );
    await expect(gameNav).toBeVisible();
    await expect(gameNav).toContainText("Memory Pairs");
  });

  test("should show Memory Lightning game name in nav when navigating to memory quiz", async ({
    page,
  }) => {
    await page.goto("/games/memory-quiz");

    // Wait for the page to load
    await page.waitForLoadState("networkidle");

    // Look for the game name in the navigation
    const gameNav = page.locator(
      '[data-testid="nav-slot"], h1:has-text("Memory Lightning")',
    );
    await expect(gameNav).toBeVisible();
    await expect(gameNav).toContainText("Memory Lightning");
  });

  test("should maintain game name in nav after page reload", async ({
    page,
  }) => {
    // Navigate to matching game
    await page.goto("/games/matching");
    await page.waitForLoadState("networkidle");

    // Verify game name appears
    const gameNav = page.locator('h1:has-text("Memory Pairs")');
    await expect(gameNav).toBeVisible();

    // Reload the page
    await page.reload();
    await page.waitForLoadState("networkidle");

    // Verify game name still appears after reload
    await expect(gameNav).toBeVisible();
    await expect(gameNav).toContainText("Memory Pairs");
  });

  test("should show different game names when navigating between games", async ({
    page,
  }) => {
    // Start with matching game
    await page.goto("/games/matching");
    await page.waitForLoadState("networkidle");

    const matchingNav = page.locator('h1:has-text("Memory Pairs")');
    await expect(matchingNav).toBeVisible();

    // Navigate to memory quiz
    await page.goto("/games/memory-quiz");
    await page.waitForLoadState("networkidle");

    const quizNav = page.locator('h1:has-text("Memory Lightning")');
    await expect(quizNav).toBeVisible();

    // Verify the matching game name is gone
    await expect(matchingNav).not.toBeVisible();
  });

  test("should not show game name on non-game pages", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should not see any game names on the home page
    const gameNavs = page.locator(
      'h1:has-text("Memory Pairs"), h1:has-text("Memory Lightning")',
    );
    await expect(gameNavs).toHaveCount(0);
  });
});
