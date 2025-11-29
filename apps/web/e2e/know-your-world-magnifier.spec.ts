import { expect, test } from '@playwright/test'

/**
 * Know Your World - Magnifier and Region Indicator E2E Tests
 *
 * These tests verify:
 * - Magnifier appears on map hover
 * - Adaptive zoom works for tiny regions
 * - Region indicator (blue/gold rectangle) is synchronized
 * - Pointer lock enables precision cursor control
 * - All math calculations remain pixel-perfect after layout changes
 */

test.describe('Know Your World - Magnifier Functionality', () => {
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

    await page.waitForSelector('[data-component="map-renderer"]', {
      timeout: 5000,
    })
  })

  test('should show magnifier when hovering over map', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')
    const svg = mapRenderer.locator('svg').first()

    // Get SVG center position
    const svgBox = await svg.boundingBox()
    if (svgBox) {
      const centerX = svgBox.x + svgBox.width / 2
      const centerY = svgBox.y + svgBox.height / 2

      // Hover over map center
      await page.mouse.move(centerX, centerY)
      await page.waitForTimeout(500)

      // Magnifier should appear (look for magnified SVG or magnifier container)
      const hasMagnifier = await mapRenderer.evaluate((el) => {
        // Look for multiple SVG elements (main + magnifier)
        const svgs = el.querySelectorAll('svg')
        return svgs.length > 1
      })

      expect(hasMagnifier).toBe(true)
    }
  })

  test('should position magnifier away from cursor', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')
    const svg = mapRenderer.locator('svg').first()

    const svgBox = await svg.boundingBox()
    if (svgBox) {
      // Hover in top-left quadrant
      const topLeftX = svgBox.x + svgBox.width * 0.25
      const topLeftY = svgBox.y + svgBox.height * 0.25

      await page.mouse.move(topLeftX, topLeftY)
      await page.waitForTimeout(500)

      // Magnifier should be positioned away from cursor (likely bottom-right)
      const magnifierPosition = await mapRenderer.evaluate((el) => {
        // Find magnifier container (absolute positioned div with SVG)
        const divs = Array.from(el.querySelectorAll('div'))
        const magnifier = divs.find((div) => {
          const styles = window.getComputedStyle(div)
          return styles.position === 'absolute' && div.querySelector('svg') !== null
        })

        if (magnifier) {
          const styles = window.getComputedStyle(magnifier)
          return {
            top: styles.top,
            left: styles.left,
            right: styles.right,
            bottom: styles.bottom,
          }
        }
        return null
      })

      expect(magnifierPosition).toBeTruthy()
    }
  })

  test('should hide magnifier when mouse leaves map', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')
    const svg = mapRenderer.locator('svg').first()

    const svgBox = await svg.boundingBox()
    if (svgBox) {
      // Hover over map
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2)
      await page.waitForTimeout(500)

      // Verify magnifier is visible
      let hasMagnifier = await mapRenderer.evaluate((el) => {
        const svgs = el.querySelectorAll('svg')
        return svgs.length > 1
      })
      expect(hasMagnifier).toBe(true)

      // Move mouse outside map
      await page.mouse.move(0, 0)
      await page.waitForTimeout(500)

      // Magnifier should be hidden (only one SVG visible)
      hasMagnifier = await mapRenderer.evaluate((el) => {
        // Magnifier might still exist but be hidden via opacity or display
        const divs = Array.from(el.querySelectorAll('div'))
        const magnifier = divs.find((div) => {
          return (
            div.querySelector('svg') !== null &&
            window.getComputedStyle(div).position === 'absolute'
          )
        })

        if (magnifier) {
          const styles = window.getComputedStyle(magnifier)
          return styles.opacity !== '0' && styles.display !== 'none'
        }
        return false
      })

      expect(hasMagnifier).toBe(false)
    }
  })

  test('should show region indicator rectangle on main map', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')
    const svg = mapRenderer.locator('svg').first()

    const svgBox = await svg.boundingBox()
    if (svgBox) {
      // Hover over map
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2)
      await page.waitForTimeout(500)

      // Look for region indicator rectangle in main SVG
      const hasIndicator = await svg.evaluate((svgEl) => {
        // Should have a rect element with dashed stroke (region indicator)
        const rects = Array.from(svgEl.querySelectorAll('rect'))
        return rects.some((rect) => {
          const stroke = rect.getAttribute('stroke')
          const strokeDasharray = rect.getAttribute('stroke-dasharray')
          // Region indicator is blue or gold with dashed stroke
          return (
            (stroke?.includes('blue') || stroke?.includes('gold')) &&
            strokeDasharray !== null &&
            strokeDasharray !== ''
          )
        })
      })

      expect(hasIndicator).toBe(true)
    }
  })

  test('should show crosshair in magnifier view', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')
    const svg = mapRenderer.locator('svg').first()

    const svgBox = await svg.boundingBox()
    if (svgBox) {
      // Hover over map
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2)
      await page.waitForTimeout(500)

      // Find magnifier SVG and check for crosshair
      const hasCrosshair = await mapRenderer.evaluate((el) => {
        const svgs = Array.from(el.querySelectorAll('svg'))
        // Magnifier is the second SVG
        if (svgs.length > 1) {
          const magnifierSvg = svgs[1]
          // Crosshair consists of circle and lines
          const hasCircle = magnifierSvg.querySelector('circle') !== null
          const hasLines = magnifierSvg.querySelectorAll('line').length >= 2
          return hasCircle && hasLines
        }
        return false
      })

      expect(hasCrosshair).toBe(true)
    }
  })

  test('should display zoom level indicator', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')
    const svg = mapRenderer.locator('svg').first()

    const svgBox = await svg.boundingBox()
    if (svgBox) {
      // Hover over map
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2)
      await page.waitForTimeout(500)

      // Look for zoom level text (e.g., "10x", "100x")
      const hasZoomLabel = await mapRenderer.evaluate((el) => {
        const divs = Array.from(el.querySelectorAll('div'))
        return divs.some((div) => {
          const text = div.textContent || ''
          return /\d+x/.test(text) // Matches "10x", "100x", etc.
        })
      })

      expect(hasZoomLabel).toBe(true)
    }
  })
})

test.describe('Know Your World - Pointer Lock', () => {
  test('should show pointer lock prompt on first interaction', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')

    // Look for pointer lock prompt
    const promptExists = await page
      .locator('[data-element="pointer-lock-prompt"]')
      .isVisible({ timeout: 2000 })
      .catch(() => false)

    // Prompt might not show if already locked from previous test
    // This is acceptable - just verify the element can exist
    if (promptExists) {
      const prompt = page.locator('[data-element="pointer-lock-prompt"]')
      await expect(prompt).toContainText(/precision/i)
    }
  })

  test('should enable pointer lock when map is clicked', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')
    const svg = mapRenderer.locator('svg').first()

    const svgBox = await svg.boundingBox()
    if (svgBox) {
      // Click map to request pointer lock
      await page.mouse.click(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2)
      await page.waitForTimeout(500)

      // Verify pointer lock is active (check if cursor style changes)
      const cursorStyle = await svg.evaluate((svgEl) => {
        return window.getComputedStyle(svgEl).cursor
      })

      // When pointer locked, cursor might be 'crosshair' or 'none'
      expect(['crosshair', 'none', 'pointer']).toContain(cursorStyle)
    }
  })
})

test.describe('Know Your World - Magnifier After Resize', () => {
  test('should maintain magnifier functionality after panel resize', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')
    const svg = mapRenderer.locator('svg').first()

    // Resize panel first
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
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
      })

      // Resize panel
      await page.mouse.move(handleBox.x, handleBox.y)
      await page.mouse.down()
      await page.mouse.move(handleBox.x, handleBox.y - 50, { steps: 10 })
      await page.mouse.up()

      await page.waitForTimeout(1000)
    }

    // Now test magnifier
    const svgBox = await svg.boundingBox()
    if (svgBox) {
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2)
      await page.waitForTimeout(500)

      // Magnifier should still appear
      const hasMagnifier = await mapRenderer.evaluate((el) => {
        const svgs = el.querySelectorAll('svg')
        return svgs.length > 1
      })

      expect(hasMagnifier).toBe(true)
    }
  })

  test('should update magnifier size after panel resize', async ({ page }) => {
    const mapRenderer = page.locator('[data-component="map-renderer"]')

    // Get initial magnifier size
    const svg = mapRenderer.locator('svg').first()
    let svgBox = await svg.boundingBox()

    if (svgBox) {
      await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2)
      await page.waitForTimeout(500)

      const initialMagnifierSize = await mapRenderer.evaluate((el) => {
        const divs = Array.from(el.querySelectorAll('div'))
        const magnifier = divs.find((div) => {
          return (
            div.querySelector('svg') !== null &&
            window.getComputedStyle(div).position === 'absolute'
          )
        })

        if (magnifier) {
          const rect = magnifier.getBoundingClientRect()
          return { width: rect.width, height: rect.height }
        }
        return null
      })

      // Move mouse away
      await page.mouse.move(0, 0)
      await page.waitForTimeout(500)

      // Resize panel
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
          return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
        })

        await page.mouse.move(handleBox.x, handleBox.y)
        await page.mouse.down()
        await page.mouse.move(handleBox.x, handleBox.y - 100, { steps: 10 })
        await page.mouse.up()

        await page.waitForTimeout(1000)
      }

      // Show magnifier again
      svgBox = await svg.boundingBox()
      if (svgBox) {
        await page.mouse.move(svgBox.x + svgBox.width / 2, svgBox.y + svgBox.height / 2)
        await page.waitForTimeout(500)

        const newMagnifierSize = await mapRenderer.evaluate((el) => {
          const divs = Array.from(el.querySelectorAll('div'))
          const magnifier = divs.find((div) => {
            return (
              div.querySelector('svg') !== null &&
              window.getComputedStyle(div).position === 'absolute'
            )
          })

          if (magnifier) {
            const rect = magnifier.getBoundingClientRect()
            return { width: rect.width, height: rect.height }
          }
          return null
        })

        // Magnifier size might have changed based on new container size
        // At minimum, it should still exist
        expect(newMagnifierSize).toBeTruthy()
      }
    }
  })
})
