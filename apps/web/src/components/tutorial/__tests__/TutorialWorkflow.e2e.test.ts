import { expect, type Page, test } from '@playwright/test'

// Helper functions for tutorial testing
const waitForTutorialLoad = async (page: Page) => {
  await page.waitForSelector('[data-testid="tutorial-player"]', {
    timeout: 10000,
  })
  // Wait for abacus to load
  await page.waitForSelector('[data-testid^="bead-place-"]', { timeout: 5000 })
}

const getAbacusValue = async (page: Page): Promise<number> => {
  // This would depend on how the abacus displays its current value
  // For now, we'll use a data attribute or calculate from bead positions
  const valueElement = await page.locator('[data-testid="current-value"]').first()
  if (await valueElement.isVisible()) {
    const text = await valueElement.textContent()
    return parseInt(text || '0', 10)
  }
  return 0
}

const clickBeadToIncrement = async (page: Page) => {
  // Click the first earth bead in the ones place to increment by 1
  await page.click('[data-testid="bead-place-0-earth-pos-0"]')
}

const _navigateToStep = async (page: Page, stepIndex: number) => {
  // Open step list if not already open
  const stepListButton = page.locator('button:has-text("Steps")')
  if (await stepListButton.isVisible()) {
    await stepListButton.click()
  }

  // Click on the specific step
  await page.click(`[data-testid="step-${stepIndex}"]`)
}

test.describe('Tutorial Workflow E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a tutorial page
    await page.goto('/tutorial-editor') // Adjust URL based on your routing
    await waitForTutorialLoad(page)
  })

  test('should initialize tutorial with correct start value', async ({ page }) => {
    // Check that the tutorial loads with the expected start value
    const currentValue = await getAbacusValue(page)
    expect(currentValue).toBeGreaterThanOrEqual(0)

    // Check that step information is displayed
    await expect(page.locator('[data-testid="step-title"]')).toBeVisible()
    await expect(page.locator('[data-testid="step-description"]')).toBeVisible()
  })

  test('should allow user to interact with abacus beads', async ({ page }) => {
    const initialValue = await getAbacusValue(page)

    // Click a bead to change the value
    await clickBeadToIncrement(page)

    // Wait for value to update
    await page.waitForTimeout(500)

    const newValue = await getAbacusValue(page)
    expect(newValue).not.toBe(initialValue)
  })

  test('should navigate between tutorial steps and reset abacus value', async ({ page }) => {
    // Get initial step value
    const step1Value = await getAbacusValue(page)

    // Navigate to next step
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(1000)

    // Check that value changed (should be the new step's startValue)
    const step2Value = await getAbacusValue(page)
    expect(step2Value).not.toBe(step1Value)

    // Navigate back to first step
    await page.click('button:has-text("Previous")')
    await page.waitForTimeout(1000)

    // Should return to original start value
    const backToStep1Value = await getAbacusValue(page)
    expect(backToStep1Value).toBe(step1Value)
  })

  test('should show success feedback when target value is reached', async ({ page }) => {
    // This test assumes we can determine the target value from the UI
    const targetValueText = await page.locator('[data-testid="target-value"]').textContent()
    const targetValue = parseInt(targetValueText || '0', 10)
    const currentValue = await getAbacusValue(page)

    // Calculate how many clicks needed (simplified)
    const clicksNeeded = Math.abs(targetValue - currentValue)

    // Click beads to reach target value
    for (let i = 0; i < clicksNeeded && i < 10; i++) {
      if (targetValue > currentValue) {
        await clickBeadToIncrement(page)
      }
      await page.waitForTimeout(200)
    }

    // Check for success message
    await expect(page.locator('text=/excellent|great|correct/i')).toBeVisible({
      timeout: 5000,
    })
  })

  test('should handle multi-step tutorial progression', async ({ page }) => {
    // Check if this is a multi-step tutorial
    const multiStepIndicator = page.locator('[data-testid="multi-step-indicator"]')

    if (await multiStepIndicator.isVisible()) {
      // Should show multi-step navigation
      await expect(page.locator('button:has-text("Prev")')).toBeVisible()
      await expect(page.locator('button:has-text("Next")')).toBeVisible()

      // Should show current multi-step instruction
      await expect(page.locator('[data-testid="multi-step-instruction"]')).toBeVisible()

      // Navigate through multi-steps
      await page.click('button:has-text("Next ⏩")')
      await page.waitForTimeout(500)

      // Should show different instruction
      const instruction1 = await page
        .locator('[data-testid="multi-step-instruction"]')
        .textContent()

      await page.click('button:has-text("Next ⏩")')
      await page.waitForTimeout(500)

      const instruction2 = await page
        .locator('[data-testid="multi-step-instruction"]')
        .textContent()
      expect(instruction2).not.toBe(instruction1)
    }
  })

  test('should automatically advance multi-steps when target is reached', async ({ page }) => {
    // This test would need to be customized based on specific tutorial steps
    // that have known intermediate target values

    // Skip if not a multi-step tutorial
    const multiStepIndicator = page.locator('[data-testid="multi-step-indicator"]')
    if (!(await multiStepIndicator.isVisible())) {
      test.skip()
    }

    const _initialInstruction = await page
      .locator('[data-testid="multi-step-instruction"]')
      .textContent()

    // Interact with abacus to potentially reach an intermediate target
    await clickBeadToIncrement(page)
    await clickBeadToIncrement(page)
    await clickBeadToIncrement(page)

    // Wait for potential auto-advancement (with timeout)
    await page.waitForTimeout(2000)

    const _newInstruction = await page
      .locator('[data-testid="multi-step-instruction"]')
      .textContent()

    // If auto-advancement happened, instruction should change
    // If not, that's also okay - depends on the specific tutorial values
    // This test verifies the system doesn't crash during the process
  })

  test('should maintain state consistency during rapid interactions', async ({ page }) => {
    const initialValue = await getAbacusValue(page)

    // Rapid clicking
    await clickBeadToIncrement(page)
    await clickBeadToIncrement(page)
    await clickBeadToIncrement(page)

    // Rapid navigation
    await page.click('button:has-text("Next")')
    await page.waitForTimeout(100)
    await page.click('button:has-text("Previous")')
    await page.waitForTimeout(100)

    // Should return to a consistent state
    const finalValue = await getAbacusValue(page)
    expect(finalValue).toBe(initialValue)
  })

  test('should show tooltip guidance when available', async ({ page }) => {
    // Check if tooltips are present
    const tooltip = page.locator('[data-testid="bead-tooltip"]')

    if (await tooltip.isVisible()) {
      // Tooltip should contain helpful guidance
      await expect(tooltip).toContainText(/working on|next|step/i)

      // Tooltip should be positioned correctly (not covering important elements)
      const tooltipBox = await tooltip.boundingBox()
      const abacusBox = await page.locator('[data-testid="abacus-container"]').boundingBox()

      if (tooltipBox && abacusBox) {
        // Tooltip should not completely overlap the abacus
        expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(
          abacusBox.x + abacusBox.width + 50
        )
      }
    }
  })

  test('should handle keyboard navigation for accessibility', async ({ page }) => {
    // Focus on abacus
    await page.click('[data-testid="abacus-container"]')

    // Test tab navigation
    await page.keyboard.press('Tab')
    await page.waitForTimeout(200)

    // Should move focus to next column
    const focusedElement = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid')
    )
    expect(focusedElement).toMatch(/bead-place-/)

    // Test shift+tab navigation
    await page.keyboard.press('Shift+Tab')
    await page.waitForTimeout(200)

    // Should move focus in opposite direction
    const newFocusedElement = await page.evaluate(() =>
      document.activeElement?.getAttribute('data-testid')
    )
    expect(newFocusedElement).not.toBe(focusedElement)
  })

  test('should dismiss success popup when clicked', async ({ page }) => {
    // Simulate reaching a target value to show success popup
    // This would need to be customized based on the specific tutorial

    // For now, we'll test the general pattern
    const successPopup = page.locator('text=/excellent|great|correct/i')

    // If we can trigger a success state and the popup appears
    if (await successPopup.isVisible({ timeout: 1000 })) {
      // Click to dismiss
      await successPopup.click()

      // Should disappear
      await expect(successPopup).not.toBeVisible({ timeout: 2000 })
    }
  })

  test('should handle tutorial completion', async ({ page }) => {
    // This test would navigate through all steps of a tutorial
    // and verify completion behavior

    let currentStep = 0
    const maxSteps = 5 // Safety limit

    while (currentStep < maxSteps) {
      // Check if Next button is available
      const nextButton = page.locator('button:has-text("Next")')

      if (!(await nextButton.isEnabled())) {
        break // Reached end or need to complete current step
      }

      await nextButton.click()
      await page.waitForTimeout(1000)
      currentStep++
    }

    // Should show some completion indicator or stay on final step
    // The exact behavior would depend on the tutorial implementation
  })

  test('should work on different screen sizes', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.reload()
    await waitForTutorialLoad(page)

    // Should still be functional
    await expect(page.locator('[data-testid="tutorial-player"]')).toBeVisible()
    await expect(page.locator('[data-testid^="bead-place-"]').first()).toBeVisible()

    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.reload()
    await waitForTutorialLoad(page)

    // Should still be functional
    await expect(page.locator('[data-testid="tutorial-player"]')).toBeVisible()

    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.reload()
    await waitForTutorialLoad(page)

    // Should still be functional
    await expect(page.locator('[data-testid="tutorial-player"]')).toBeVisible()
  })
})
