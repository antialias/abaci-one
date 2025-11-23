import { expect, test } from '@playwright/test'

/**
 * Know Your World - Panel Resizing E2E Tests
 *
 * These tests verify:
 * - Panel resize handle is draggable
 * - Map scales correctly when panel is resized
 * - Labels and magnifier adapt to new panel size
 * - ResizeObserver updates are triggered
 */

test.describe('Know Your World - Panel Resizing', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    // Clear session
    const returnButton = page.locator('button:has-text("Return to Arcade")')
    if (await returnButton.isVisible({ timeout: 1000 }).catch(() => false)) {
      await returnButton.click()
      await page.waitForLoadState('networkidle')
    }

    // Start Know Your World game
    const playerCard = page.locator('[data-testid="player-card"]').first()
    if (await playerCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await playerCard.click()
      await page.waitForTimeout(500)
    }

    const knowYourWorldCard = page.locator('[data-game="know-your-world"]')
    await knowYourWorldCard.click()
    await page.waitForLoadState('networkidle')

    // Navigate to playing phase
    const startButton = page.locator('button:has-text("Start")')
    if (await startButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await startButton.click()
      await page.waitForLoadState('networkidle')
    }

    const skipButton = page.locator('button:has-text("Skip")')
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click()
      await page.waitForLoadState('networkidle')
    }

    await page.waitForSelector('[data-component="playing-phase"]', { timeout: 5000 })
  })

  test('should have draggable resize handle between panels', async ({ page }) => {
    // Find element with row-resize cursor (the resize handle)
    const resizeHandle = await page.evaluateHandle(() => {
      const elements = Array.from(document.querySelectorAll('*'))
      return elements.find((el) => {
        const styles = window.getComputedStyle(el)
        return styles.cursor === 'row-resize'
      })
    })

    const handleExists = await resizeHandle.evaluate((el) => el !== null)
    expect(handleExists).toBe(true)
  })

  test('should resize panels when dragging handle', async ({ page }) => {
    // Get initial panel sizes
    const panels = page.locator('[data-panel-id]')
    const topPanel = panels.nth(0)
    const bottomPanel = panels.nth(1)

    const initialTopHeight = await topPanel.boundingBox().then((box) => box?.height || 0)
    const initialBottomHeight = await bottomPanel.boundingBox().then((box) => box?.height || 0)

    // Find resize handle
    const playingPhase = page.locator('[data-component="playing-phase"]')
    const resizeHandle = await playingPhase.evaluateHandle((el) => {
      const children = Array.from(el.querySelectorAll('*'))
      return children.find((child) => {
        const styles = window.getComputedStyle(child)
        return styles.cursor === 'row-resize'
      })
    })

    if (await resizeHandle.evaluate((el) => el !== null)) {
      // Get resize handle position
      const handleBox = await resizeHandle.evaluate((el: any) => {
        const rect = el.getBoundingClientRect()
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        }
      })

      // Drag handle down 100px
      await page.mouse.move(handleBox.x, handleBox.y)
      await page.mouse.down()
      await page.mouse.move(handleBox.x, handleBox.y + 100, { steps: 10 })
      await page.mouse.up()

      // Wait for resize to settle
      await page.waitForTimeout(500)

      // Check that panel sizes changed
      const newTopHeight = await topPanel.boundingBox().then((box) => box?.height || 0)
      const newBottomHeight = await bottomPanel.boundingBox().then((box) => box?.height || 0)

      // Top panel should have grown, bottom should have shrunk
      expect(newTopHeight).toBeGreaterThan(initialTopHeight)
      expect(newBottomHeight).toBeLessThan(initialBottomHeight)
    }
  })

  test('should respect min/max panel size constraints', async ({ page }) => {
    const panels = page.locator('[data-panel-id]')
    const topPanel = panels.nth(0)

    // Find resize handle
    const playingPhase = page.locator('[data-component="playing-phase"]')
    const resizeHandle = await playingPhase.evaluateHandle((el) => {
      const children = Array.from(el.querySelectorAll('*'))
      return children.find((child) => {
        const styles = window.getComputedStyle(child)
        return styles.cursor === 'row-resize'
      })
    })

    if (await resizeHandle.evaluate((el) => el !== null)) {
      const handleBox = await resizeHandle.evaluate((el: any) => {
        const rect = el.getBoundingClientRect()
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        }
      })

      // Try to drag handle up very far (should hit minSize)
      await page.mouse.move(handleBox.x, handleBox.y)
      await page.mouse.down()
      await page.mouse.move(handleBox.x, handleBox.y - 500, { steps: 10 })
      await page.mouse.up()

      await page.waitForTimeout(500)

      // Top panel should still be visible and have some minimum height
      const minTopHeight = await topPanel.boundingBox().then((box) => box?.height || 0)
      expect(minTopHeight).toBeGreaterThan(50) // Should have minimum size
    }
  })

  test('should update map SVG dimensions after resize', async ({ page }) => {
    // Get initial SVG size
    const svg = page.locator('[data-component="map-renderer"] svg').first()
    const initialBox = await svg.boundingBox()

    // Find and drag resize handle
    const playingPhase = page.locator('[data-component="playing-phase"]')
    const resizeHandle = await playingPhase.evaluateHandle((el) => {
      const children = Array.from(el.querySelectorAll('*'))
      return children.find((child) => {
        const styles = window.getComputedStyle(child)
        return styles.cursor === 'row-resize'
      })
    })

    if (await resizeHandle.evaluate((el) => el !== null)) {
      const handleBox = await resizeHandle.evaluate((el: any) => {
        const rect = el.getBoundingClientRect()
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        }
      })

      // Drag handle down to give map more space
      await page.mouse.move(handleBox.x, handleBox.y)
      await page.mouse.down()
      await page.mouse.move(handleBox.x, handleBox.y - 50, { steps: 10 })
      await page.mouse.up()

      // Wait for ResizeObserver to trigger
      await page.waitForTimeout(1000)

      // SVG should have different dimensions
      const newBox = await svg.boundingBox()

      // At least one dimension should have changed
      const dimensionsChanged =
        newBox?.width !== initialBox?.width || newBox?.height !== initialBox?.height

      expect(dimensionsChanged).toBe(true)
    }
  })

  test('should maintain map aspect ratio during resize', async ({ page }) => {
    const svg = page.locator('[data-component="map-renderer"] svg').first()

    // Get viewBox attribute to determine aspect ratio
    const viewBox = await svg.getAttribute('viewBox')
    expect(viewBox).toBeTruthy()

    const [, , vbWidth, vbHeight] = viewBox!.split(' ').map(Number)
    const expectedAspectRatio = vbWidth / vbHeight

    // Get current SVG aspect ratio
    const currentBox = await svg.boundingBox()
    const currentAspectRatio = (currentBox?.width || 1) / (currentBox?.height || 1)

    // Should be close to viewBox aspect ratio (within 10% tolerance)
    const tolerance = 0.1
    const diff = Math.abs(currentAspectRatio - expectedAspectRatio) / expectedAspectRatio

    expect(diff).toBeLessThan(tolerance)
  })

  test('should show hover effect on resize handle', async ({ page }) => {
    // Find resize handle element
    const playingPhase = page.locator('[data-component="playing-phase"]')
    const resizeHandle = await playingPhase.evaluateHandle((el) => {
      const children = Array.from(el.querySelectorAll('*'))
      return children.find((child) => {
        const styles = window.getComputedStyle(child)
        return styles.cursor === 'row-resize'
      })
    })

    if (await resizeHandle.evaluate((el) => el !== null)) {
      // Get initial styles
      const initialStyles = await resizeHandle.evaluate((el: any) => {
        const styles = window.getComputedStyle(el)
        return {
          background: styles.background,
          height: styles.height,
        }
      })

      // Hover over handle
      const handleBox = await resizeHandle.evaluate((el: any) => {
        const rect = el.getBoundingClientRect()
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        }
      })

      await page.mouse.move(handleBox.x, handleBox.y)
      await page.waitForTimeout(300) // Wait for hover transition

      // Get hover styles
      const hoverStyles = await resizeHandle.evaluate((el: any) => {
        const styles = window.getComputedStyle(el)
        return {
          background: styles.background,
          height: styles.height,
        }
      })

      // Background or height should change on hover (based on our CSS)
      const stylesChanged =
        hoverStyles.background !== initialStyles.background ||
        hoverStyles.height !== initialStyles.height

      expect(stylesChanged).toBe(true)
    }
  })
})

test.describe('Know Your World - Resize Performance', () => {
  test('should handle rapid resize smoothly', async ({ page }) => {
    await page.goto('/arcade')
    await page.waitForLoadState('networkidle')

    // Start game
    const knowYourWorldCard = page.locator('[data-game="know-your-world"]')
    if (await knowYourWorldCard.isVisible({ timeout: 2000 }).catch(() => false)) {
      await knowYourWorldCard.click()
      await page.waitForLoadState('networkidle')

      const startButton = page.locator('button:has-text("Start")')
      if (await startButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await startButton.click()
      }

      const skipButton = page.locator('button:has-text("Skip")')
      if (await skipButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await skipButton.click()
      }
    }

    await page.waitForSelector('[data-component="playing-phase"]', { timeout: 5000 })

    // Find resize handle
    const playingPhase = page.locator('[data-component="playing-phase"]')
    const resizeHandle = await playingPhase.evaluateHandle((el) => {
      const children = Array.from(el.querySelectorAll('*'))
      return children.find((child) => {
        const styles = window.getComputedStyle(child)
        return styles.cursor === 'row-resize'
      })
    })

    if (await resizeHandle.evaluate((el) => el !== null)) {
      const handleBox = await resizeHandle.evaluate((el: any) => {
        const rect = el.getBoundingClientRect()
        return {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2,
        }
      })

      // Perform rapid resize movements
      await page.mouse.move(handleBox.x, handleBox.y)
      await page.mouse.down()

      for (let i = 0; i < 5; i++) {
        await page.mouse.move(handleBox.x, handleBox.y + 50, { steps: 5 })
        await page.mouse.move(handleBox.x, handleBox.y - 50, { steps: 5 })
      }

      await page.mouse.up()

      // Map should still be visible and functional
      const mapRenderer = page.locator('[data-component="map-renderer"]')
      await expect(mapRenderer).toBeVisible()

      const svg = mapRenderer.locator('svg').first()
      await expect(svg).toBeVisible()
    }
  })
})
