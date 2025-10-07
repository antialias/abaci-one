import { expect, test } from '@playwright/test'

test.describe('Sound Settings Persistence', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
  })

  test('should persist sound enabled setting to localStorage', async ({ page }) => {
    await page.goto('/games/memory-quiz')

    // Open style dropdown
    await page.getByRole('button', { name: /style/i }).click()

    // Find and toggle the sound switch (should be off by default)
    const soundSwitch = page
      .locator('[role="switch"]')
      .filter({ hasText: /sound/i })
      .or(page.locator('input[type="checkbox"]').filter({ hasText: /sound/i }))
      .or(page.getByLabel(/sound/i))
      .or(page.locator('button').filter({ hasText: /sound/i }))
      .first()

    await soundSwitch.click()

    // Check localStorage was updated
    const storedConfig = await page.evaluate(() => {
      const stored = localStorage.getItem('soroban-abacus-display-config')
      return stored ? JSON.parse(stored) : null
    })

    expect(storedConfig).toBeTruthy()
    expect(storedConfig.soundEnabled).toBe(true)

    // Reload page and verify setting persists
    await page.reload()
    await page.getByRole('button', { name: /style/i }).click()

    const soundSwitchAfterReload = page
      .locator('[role="switch"]')
      .filter({ hasText: /sound/i })
      .or(page.locator('input[type="checkbox"]').filter({ hasText: /sound/i }))
      .or(page.getByLabel(/sound/i))
      .or(page.locator('button').filter({ hasText: /sound/i }))
      .first()

    await expect(soundSwitchAfterReload).toBeChecked()
  })

  test('should persist sound volume setting to localStorage', async ({ page }) => {
    await page.goto('/games/memory-quiz')

    // Open style dropdown
    await page.getByRole('button', { name: /style/i }).click()

    // Find volume slider
    const volumeSlider = page
      .locator('input[type="range"]')
      .or(page.locator('[role="slider"]'))
      .first()

    // Set volume to a specific value (e.g., 0.6)
    await volumeSlider.fill('60') // Assuming 0-100 range

    // Check localStorage was updated
    const storedConfig = await page.evaluate(() => {
      const stored = localStorage.getItem('soroban-abacus-display-config')
      return stored ? JSON.parse(stored) : null
    })

    expect(storedConfig).toBeTruthy()
    expect(storedConfig.soundVolume).toBeCloseTo(0.6, 1)

    // Reload page and verify setting persists
    await page.reload()
    await page.getByRole('button', { name: /style/i }).click()

    const volumeSliderAfterReload = page
      .locator('input[type="range"]')
      .or(page.locator('[role="slider"]'))
      .first()

    const volumeValue = await volumeSliderAfterReload.inputValue()
    expect(parseFloat(volumeValue)).toBeCloseTo(60, 0) // Allow for some variance
  })

  test('should load default sound settings when localStorage is empty', async ({ page }) => {
    await page.goto('/games/memory-quiz')

    // Check that default settings are loaded
    const storedConfig = await page.evaluate(() => {
      const stored = localStorage.getItem('soroban-abacus-display-config')
      return stored ? JSON.parse(stored) : null
    })

    // Should have default values: soundEnabled: true, soundVolume: 0.8
    expect(storedConfig).toBeTruthy()
    expect(storedConfig.soundEnabled).toBe(true)
    expect(storedConfig.soundVolume).toBe(0.8)
  })

  test('should handle invalid localStorage data gracefully', async ({ page }) => {
    // Set invalid localStorage data
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.setItem('soroban-abacus-display-config', 'invalid-json')
    })

    await page.goto('/games/memory-quiz')

    // Should fall back to defaults and not crash
    const storedConfig = await page.evaluate(() => {
      const stored = localStorage.getItem('soroban-abacus-display-config')
      return stored ? JSON.parse(stored) : null
    })

    expect(storedConfig.soundEnabled).toBe(true)
    expect(storedConfig.soundVolume).toBe(0.8)
  })
})
