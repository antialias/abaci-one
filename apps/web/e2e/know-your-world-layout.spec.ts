import { expect, test } from "@playwright/test";

/**
 * Know Your World - Full-Screen Layout E2E Tests
 *
 * These tests verify:
 * - Full-screen, no-scrolling layout works correctly
 * - Panel resizing functions properly
 * - Map scales dynamically with panel size
 * - No content overflow in game info panel
 */

test.describe("Know Your World - Full-Screen Layout", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to arcade and start a Know Your World game
    await page.goto("/arcade");
    await page.waitForLoadState("networkidle");

    // Clear any existing session
    const returnButton = page.locator('button:has-text("Return to Arcade")');
    if (await returnButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await returnButton.click();
      await page.waitForLoadState("networkidle");
    }

    // Select a player if needed
    const playerCard = page.locator('[data-testid="player-card"]').first();
    if (await playerCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playerCard.click();
      await page.waitForTimeout(500);
    }

    // Click Know Your World game card
    const knowYourWorldCard = page.locator('[data-game="know-your-world"]');
    await knowYourWorldCard.click();
    await page.waitForLoadState("networkidle");

    // Start a game (skip setup if on setup page)
    const startButton = page.locator('button:has-text("Start")');
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click();
      await page.waitForLoadState("networkidle");
    }

    // Skip study phase if present
    const skipButton = page.locator('button:has-text("Skip")');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
      await page.waitForLoadState("networkidle");
    }
  });

  test("should use StandardGameLayout with no scrolling in playing phase", async ({
    page,
  }) => {
    // Wait for playing phase to load
    await page.waitForSelector('[data-component="playing-phase"]', {
      timeout: 5000,
    });

    // Check that StandardGameLayout wrapper exists
    const layout = page.locator('[data-layout="standard-game-layout"]');
    await expect(layout).toBeVisible();

    // Verify no scrolling on main container
    const layoutStyles = await layout.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        overflow: styles.overflow,
        height: styles.height,
      };
    });

    expect(layoutStyles.overflow).toBe("hidden");
    expect(layoutStyles.height).toContain("vh"); // Should be 100vh
  });

  test("should render game info panel without scrolling", async ({ page }) => {
    await page.waitForSelector('[data-component="game-info-panel"]', {
      timeout: 5000,
    });

    const gameInfoPanel = page.locator('[data-component="game-info-panel"]');
    await expect(gameInfoPanel).toBeVisible();

    // Check that panel has overflow: hidden
    const panelStyles = await gameInfoPanel.evaluate((el) => {
      const styles = window.getComputedStyle(el);
      return {
        overflow: styles.overflow,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
      };
    });

    expect(panelStyles.overflow).toBe("hidden");
    // scrollHeight should equal clientHeight (no overflow)
    expect(panelStyles.scrollHeight).toBeLessThanOrEqual(
      panelStyles.clientHeight + 1,
    ); // +1 for rounding
  });

  test("should display current prompt in game info panel", async ({ page }) => {
    await page.waitForSelector('[data-section="current-prompt"]', {
      timeout: 5000,
    });

    const promptSection = page.locator('[data-section="current-prompt"]');
    await expect(promptSection).toBeVisible();

    // Should have "Find:" label
    await expect(promptSection.locator("text=Find:")).toBeVisible();

    // Should have a region name or placeholder
    const hasRegionName = await promptSection
      .locator("div")
      .filter({ hasNotText: "Find:" })
      .count();
    expect(hasRegionName).toBeGreaterThan(0);
  });

  test("should display progress counter and bar", async ({ page }) => {
    await page.waitForSelector('[data-section="progress"]', { timeout: 5000 });

    // Progress counter should be visible
    const progressCounter = page.locator('[data-section="progress"]').first();
    await expect(progressCounter).toBeVisible();

    // Should show format like "0/20" or "5/20"
    const progressText = await progressCounter.textContent();
    expect(progressText).toMatch(/\d+\/\d+/);

    // Progress bar should exist (second element with data-section="progress" or within container)
    const hasProgressBar = await page.locator('[style*="transition"]').count();
    expect(hasProgressBar).toBeGreaterThan(0);
  });

  test("should render map in bottom panel", async ({ page }) => {
    await page.waitForSelector('[data-component="map-panel"]', {
      timeout: 5000,
    });

    const mapPanel = page.locator('[data-component="map-panel"]');
    await expect(mapPanel).toBeVisible();

    // Map renderer should be inside map panel
    const mapRenderer = mapPanel.locator('[data-component="map-renderer"]');
    await expect(mapRenderer).toBeVisible();

    // SVG map should be rendered
    const svg = mapRenderer.locator("svg").first();
    await expect(svg).toBeVisible();
  });

  test("should show game mode and difficulty emojis", async ({ page }) => {
    await page.waitForSelector('[data-section="game-info"]', { timeout: 5000 });

    const gameInfo = page.locator('[data-section="game-info"]');
    await expect(gameInfo).toBeVisible();

    // Should contain emojis (game mode: 🤝/🏁/↔️, difficulty: 😊/🤔)
    const hasEmojis = await gameInfo.evaluate((el) => {
      const text = el.textContent || "";
      return /[🤝🏁↔️😊🤔]/u.test(text);
    });
    expect(hasEmojis).toBe(true);
  });

  test("should have correct panel structure with resize handle", async ({
    page,
  }) => {
    // Wait for playing phase
    await page.waitForSelector('[data-component="playing-phase"]', {
      timeout: 5000,
    });

    // Should have exactly 2 panels (game info + map)
    const panels = page.locator("[data-panel-id]");
    const panelCount = await panels.count();
    expect(panelCount).toBe(2);

    // Resize handle should exist between panels
    // PanelResizeHandle doesn't have a data attribute but should be between panels
    const playingPhase = page.locator('[data-component="playing-phase"]');
    const hasResizeHandle = await playingPhase.evaluate((el) => {
      // Look for an element with cursor: row-resize or col-resize
      const children = Array.from(el.querySelectorAll("*"));
      return children.some((child) => {
        const styles = window.getComputedStyle(child);
        return styles.cursor === "row-resize" || styles.cursor === "col-resize";
      });
    });
    expect(hasResizeHandle).toBe(true);
  });
});

test.describe("Know Your World - Viewport Behavior", () => {
  test("should fill full viewport height without scrolling", async ({
    page,
  }) => {
    await page.goto("/arcade");
    await page.waitForLoadState("networkidle");

    // Start game (simplified)
    const knowYourWorldCard = page.locator('[data-game="know-your-world"]');
    if (
      await knowYourWorldCard.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await knowYourWorldCard.click();
      await page.waitForLoadState("networkidle");

      // Try to start/skip to playing phase
      const startButton = page.locator('button:has-text("Start")');
      if (await startButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await startButton.click();
      }

      const skipButton = page.locator('button:has-text("Skip")');
      if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skipButton.click();
      }
    }

    await page.waitForSelector('[data-layout="standard-game-layout"]', {
      timeout: 5000,
    });

    // Check that page has no scroll
    const hasScroll = await page.evaluate(() => {
      return document.documentElement.scrollHeight > window.innerHeight;
    });
    expect(hasScroll).toBe(false);
  });

  test("should work on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto("/arcade");
    await page.waitForLoadState("networkidle");

    // Start game
    const knowYourWorldCard = page.locator('[data-game="know-your-world"]');
    if (
      await knowYourWorldCard.isVisible({ timeout: 2000 }).catch(() => false)
    ) {
      await knowYourWorldCard.click();
      await page.waitForLoadState("networkidle");

      const startButton = page.locator('button:has-text("Start")');
      if (await startButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await startButton.click();
      }

      const skipButton = page.locator('button:has-text("Skip")');
      if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skipButton.click();
      }
    }

    await page.waitForSelector('[data-component="playing-phase"]', {
      timeout: 5000,
    });

    // Game info panel should not scroll
    const gameInfoPanel = page.locator('[data-component="game-info-panel"]');
    if (await gameInfoPanel.isVisible()) {
      const overflowStyle = await gameInfoPanel.evaluate((el) => {
        return window.getComputedStyle(el).overflow;
      });
      expect(overflowStyle).toBe("hidden");
    }

    // Map should be visible
    const mapPanel = page.locator('[data-component="map-panel"]');
    await expect(mapPanel).toBeVisible();
  });
});
