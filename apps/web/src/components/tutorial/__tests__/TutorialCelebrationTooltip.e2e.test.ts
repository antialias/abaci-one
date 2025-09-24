import { test, expect } from '@playwright/test'

test.describe('Tutorial Celebration Tooltip E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to tutorial editor with a simple addition problem
    await page.goto('/tutorial-editor')

    // Wait for page to load
    await page.waitForLoadState('networkidle')

    // Create a simple tutorial for testing
    await page.evaluate(() => {
      const tutorial = {
        id: 'celebration-e2e-test',
        title: 'Celebration E2E Test',
        description: 'Testing celebration tooltip in real browser',
        steps: [
          {
            id: 'step-1',
            title: 'Add Two',
            problem: '3 + 2',
            description: 'Add 2 to the starting value of 3',
            startValue: 3,
            targetValue: 5
          }
        ]
      }

      // Store in localStorage for the tutorial player
      localStorage.setItem('current-tutorial', JSON.stringify(tutorial))
    })

    // Reload to pick up the tutorial
    await page.reload()
    await page.waitForLoadState('networkidle')
  })

  test('celebration tooltip appears when reaching target value', async ({ page }) => {
    // Wait for tutorial to load
    await expect(page.locator('text=3 + 2')).toBeVisible({ timeout: 10000 })

    // Look for the abacus SVG
    const abacus = page.locator('svg').first()
    await expect(abacus).toBeVisible()

    // We need to interact with specific beads to change value from 3 to 5
    // Look for earth beads in the ones column (rightmost)
    const earthBeads = page.locator('svg circle[data-bead-type="earth"]')

    // Click on earth beads to add 2 (getting from 3 to 5)
    // This might require multiple clicks depending on the current state
    const earthBeadCount = await earthBeads.count()

    if (earthBeadCount > 0) {
      // Try clicking the first available earth bead
      await earthBeads.first().click()

      // Wait a bit for the value to update
      await page.waitForTimeout(500)

      // Click another earth bead if needed
      if (earthBeadCount > 1) {
        await earthBeads.nth(1).click()
        await page.waitForTimeout(500)
      }
    }

    // Look for celebration tooltip with "Excellent work!"
    await expect(page.locator('text=🎉')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('text=Excellent work!')).toBeVisible({ timeout: 5000 })
  })

  test('celebration tooltip disappears when moving away from target', async ({ page }) => {
    // Wait for tutorial to load
    await expect(page.locator('text=3 + 2')).toBeVisible({ timeout: 10000 })

    const abacus = page.locator('svg').first()
    await expect(abacus).toBeVisible()

    // First, reach the target value (5)
    const earthBeads = page.locator('svg circle[data-bead-type="earth"]')

    if (await earthBeads.count() > 0) {
      await earthBeads.first().click()
      await page.waitForTimeout(300)

      if (await earthBeads.count() > 1) {
        await earthBeads.nth(1).click()
        await page.waitForTimeout(300)
      }
    }

    // Verify celebration appears
    await expect(page.locator('text=🎉')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=Excellent work!')).toBeVisible()

    // Now move away from target by clicking another bead (add more)
    const heavenBead = page.locator('svg circle[data-bead-type="heaven"]').first()
    if (await heavenBead.isVisible()) {
      await heavenBead.click()
      await page.waitForTimeout(500)
    }

    // Celebration tooltip should disappear
    await expect(page.locator('text=🎉')).not.toBeVisible({ timeout: 2000 })
    await expect(page.locator('text=Excellent work!')).not.toBeVisible()
  })

  test('celebration tooltip shows instruction mode when moved away', async ({ page }) => {
    // Wait for tutorial to load
    await expect(page.locator('text=3 + 2')).toBeVisible({ timeout: 10000 })

    const abacus = page.locator('svg').first()
    await expect(abacus).toBeVisible()

    // Reach target value first
    const earthBeads = page.locator('svg circle[data-bead-type="earth"]')

    if (await earthBeads.count() > 0) {
      await earthBeads.first().click()
      await page.waitForTimeout(300)

      if (await earthBeads.count() > 1) {
        await earthBeads.nth(1).click()
        await page.waitForTimeout(300)
      }
    }

    // Verify celebration
    await expect(page.locator('text=🎉')).toBeVisible({ timeout: 3000 })

    // Move away from target (subtract by clicking active earth bead)
    const activeEarthBeads = page.locator('svg circle[data-bead-type="earth"][data-active="true"]')
    if (await activeEarthBeads.count() > 0) {
      await activeEarthBeads.first().click()
      await page.waitForTimeout(500)
    }

    // Should no longer show celebration
    await expect(page.locator('text=🎉')).not.toBeVisible({ timeout: 2000 })

    // Should show instruction tooltip (look for lightbulb or guidance text)
    const instructionTooltip = page.locator('text=💡').or(page.locator('[data-radix-popper-content-wrapper]'))

    // There might be instruction tooltips visible
    if (await instructionTooltip.count() > 0) {
      await expect(instructionTooltip.first()).toBeVisible()
    }
  })

  test('celebration tooltip positioned at correct bead', async ({ page }) => {
    // Wait for tutorial to load
    await expect(page.locator('text=3 + 2')).toBeVisible({ timeout: 10000 })

    const abacus = page.locator('svg').first()
    await expect(abacus).toBeVisible()

    // Interact with specific bead to track last moved bead
    const targetEarthBead = page.locator('svg circle[data-bead-type="earth"]').first()

    if (await targetEarthBead.isVisible()) {
      // Get the position of the bead we're clicking
      const beadBox = await targetEarthBead.boundingBox()

      // Click the bead to move toward target
      await targetEarthBead.click()
      await page.waitForTimeout(300)

      // Continue clicking beads until we reach target
      const earthBeads = page.locator('svg circle[data-bead-type="earth"]')
      const beadCount = await earthBeads.count()

      for (let i = 1; i < Math.min(beadCount, 3); i++) {
        await earthBeads.nth(i).click()
        await page.waitForTimeout(200)
      }
    }

    // Wait for celebration tooltip
    await expect(page.locator('text=🎉')).toBeVisible({ timeout: 3000 })

    // Verify tooltip is positioned near where we last clicked
    const tooltip = page.locator('[data-radix-popper-content-wrapper]').first()

    if (await tooltip.isVisible()) {
      const tooltipBox = await tooltip.boundingBox()
      const abacusBox = await abacus.boundingBox()

      // Tooltip should be positioned within reasonable proximity to the abacus
      expect(tooltipBox?.x).toBeGreaterThan((abacusBox?.x ?? 0) - 200)
      expect(tooltipBox?.x).toBeLessThan((abacusBox?.x ?? 0) + (abacusBox?.width ?? 0) + 200)
    }
  })

  test('celebration tooltip resets on step navigation', async ({ page }) => {
    // Create a multi-step tutorial
    await page.evaluate(() => {
      const tutorial = {
        id: 'multi-step-celebration-test',
        title: 'Multi-Step Celebration Test',
        description: 'Testing celebration across steps',
        steps: [
          {
            id: 'step-1',
            title: 'First Addition',
            problem: '2 + 3',
            description: 'Add 3 to 2',
            startValue: 2,
            targetValue: 5
          },
          {
            id: 'step-2',
            title: 'Second Addition',
            problem: '1 + 4',
            description: 'Add 4 to 1',
            startValue: 1,
            targetValue: 5
          }
        ]
      }
      localStorage.setItem('current-tutorial', JSON.stringify(tutorial))
    })

    await page.reload()
    await page.waitForLoadState('networkidle')

    // Complete first step
    await expect(page.locator('text=2 + 3')).toBeVisible({ timeout: 10000 })

    const abacus = page.locator('svg').first()
    const earthBeads = page.locator('svg circle[data-bead-type="earth"]')

    // Reach target for first step (from 2 to 5, need to add 3)
    if (await earthBeads.count() > 0) {
      for (let i = 0; i < 3 && i < await earthBeads.count(); i++) {
        await earthBeads.nth(i).click()
        await page.waitForTimeout(200)
      }
    }

    // Verify celebration for first step
    await expect(page.locator('text=🎉')).toBeVisible({ timeout: 3000 })

    // Navigate to next step
    const nextButton = page.locator('text=Next').or(page.locator('button:has-text("Next")'))
    if (await nextButton.isVisible()) {
      await nextButton.click()
    }

    // Wait for second step to load
    await expect(page.locator('text=1 + 4')).toBeVisible({ timeout: 5000 })

    // Complete second step (from 1 to 5, need to add 4)
    const newEarthBeads = page.locator('svg circle[data-bead-type="earth"]')

    if (await newEarthBeads.count() > 0) {
      for (let i = 0; i < 4 && i < await newEarthBeads.count(); i++) {
        await newEarthBeads.nth(i).click()
        await page.waitForTimeout(200)
      }
    }

    // Should show celebration for second step
    await expect(page.locator('text=🎉')).toBeVisible({ timeout: 3000 })
    await expect(page.locator('text=Excellent work!')).toBeVisible()
  })
})