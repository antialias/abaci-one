'use client'

import { animated, useSpring } from '@react-spring/web'
import { ABACUS_THEMES, AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { usePathname } from 'next/navigation'
import { useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { HomeHeroContext } from '@/contexts/HomeHeroContext'
import { type DockAnimationState, useMyAbacus } from '@/contexts/MyAbacusContext'
import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../styled-system/css'

/**
 * Measure the size and position an AbacusReact will have when rendered into a dock element.
 * Temporarily renders an invisible abacus directly into the dock to get accurate positioning
 * (important for absolutely positioned docks where transforms depend on content size).
 */
function measureDockedAbacus(
  dockElement: HTMLElement,
  columns: number,
  scaleFactor: number | undefined,
  customStyles: typeof ABACUS_THEMES.light
): { x: number; y: number; width: number; height: number } {
  // Create a temporary wrapper that matches how we render the docked abacus
  const measureWrapper = document.createElement('div')
  measureWrapper.style.visibility = 'hidden'
  measureWrapper.style.pointerEvents = 'none'

  // Insert directly into the dock element so it gets proper size/position
  dockElement.appendChild(measureWrapper)

  // Create a React root and render the abacus synchronously
  const root = createRoot(measureWrapper)
  flushSync(() => {
    root.render(
      <AbacusReact
        value={0}
        columns={columns}
        scaleFactor={scaleFactor}
        showNumbers={false}
        interactive={false}
        animated={false}
        customStyles={customStyles}
      />
    )
  })

  // Measure the rendered size and position (dock element now has content, so transforms apply correctly)
  const rect = measureWrapper.getBoundingClientRect()
  const result = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }

  // Clean up
  root.unmount()
  dockElement.removeChild(measureWrapper)

  return result
}

export function MyAbacus() {
  const {
    isOpen,
    close,
    toggle,
    isHidden,
    bottomOffset,
    rightOffset,
    showInGame,
    dock,
    isDockedByUser,
    dockInto,
    undock,
    dockAnimationState,
    buttonRef,
    startDockAnimation,
    completeDockAnimation,
    startUndockAnimation,
    completeUndockAnimation,
  } = useMyAbacus()
  const appConfig = useAbacusConfig()
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Local ref for the button container (we'll connect this to context's buttonRef)
  const localButtonRef = useRef<HTMLDivElement>(null)

  // Sync with hero context if on home page
  const homeHeroContext = useContext(HomeHeroContext)
  const [localAbacusValue, setLocalAbacusValue] = useState(1234)
  const abacusValue = homeHeroContext?.abacusValue ?? localAbacusValue
  const setAbacusValue = homeHeroContext?.setAbacusValue ?? setLocalAbacusValue

  // Determine display mode - only hero mode on actual home page
  const isOnHomePage =
    pathname === '/' ||
    pathname === '/en' ||
    pathname === '/de' ||
    pathname === '/ja' ||
    pathname === '/hi' ||
    pathname === '/es' ||
    pathname === '/la'
  const isHeroVisible = homeHeroContext?.isHeroVisible ?? false
  const isHeroMode = isOnHomePage && isHeroVisible && !isOpen
  // Only render in docked mode if user has chosen to dock
  const isDocked = isDockedByUser && dock !== null && !isOpen
  // Show dockable indicator when dock is visible in viewport but not yet docked
  const isDockable = !isDockedByUser && dock?.isVisible && !isOpen && !isHeroMode

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [isOpen, close])

  // Prevent body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Use theme presets from abacus-react instead of manual definitions
  const structuralStyles = ABACUS_THEMES.light
  const trophyStyles = ABACUS_THEMES.trophy

  // Helper to calculate effective scale factor based on container dimensions
  // Can be called synchronously (for animations) or in effects (for re-rendering)
  const calculateEffectiveScaleFactor = useCallback(
    (dockElement: HTMLElement, columns: number, explicitScaleFactor?: number): number => {
      // If explicit scaleFactor provided, use it
      if (explicitScaleFactor !== undefined) {
        return explicitScaleFactor
      }

      const containerHeight = dockElement.offsetHeight
      const containerWidth = dockElement.offsetWidth

      if (containerHeight <= 0 || containerWidth <= 0) {
        return 1 // Default to scale 1 if container has no size
      }

      // Measure abacus at scale=1 to get base dimensions
      const baseRect = measureDockedAbacus(dockElement, columns, 1, structuralStyles)

      if (baseRect.height <= 0) {
        return 1
      }

      // Calculate scale to fit container, constrained by both width and height
      const scaleByHeight = containerHeight / baseRect.height
      const scaleByWidth = containerWidth / baseRect.width
      const fittingScale = Math.min(scaleByHeight, scaleByWidth)

      // Round to 2 decimal places for stability
      return Math.round(fittingScale * 100) / 100
    },
    [structuralStyles]
  )

  // Auto-calculate scaleFactor when dock doesn't specify one
  // Based on container dimensions - scale abacus to fit height while maintaining aspect
  const [autoScaleFactor, setAutoScaleFactor] = useState<number | undefined>(undefined)

  // Measure dock container and calculate appropriate scaleFactor
  useEffect(() => {
    if (!dock?.element || dock.scaleFactor !== undefined) {
      // If dock specifies scaleFactor, don't auto-calculate
      setAutoScaleFactor(undefined)
      return
    }

    const calculateScale = () => {
      const scale = calculateEffectiveScaleFactor(dock.element, dock.columns ?? 5)
      setAutoScaleFactor(scale)
    }

    // Initial calculation
    calculateScale()

    // Recalculate on resize
    const observer = new ResizeObserver(() => calculateScale())
    observer.observe(dock.element)

    return () => observer.disconnect()
  }, [dock?.element, dock?.scaleFactor, dock?.columns, calculateEffectiveScaleFactor])

  // Effective scaleFactor: explicit > auto-calculated > undefined (AbacusReact default)
  const effectiveScaleFactor = dock?.scaleFactor ?? autoScaleFactor

  // Detect if we're on a game route (arcade games hide the abacus by default)
  // This matches /arcade, /arcade/*, and /arcade-rooms/*
  const isOnGameRoute = pathname?.startsWith('/arcade')

  // Sync local button ref with context's buttonRef
  useEffect(() => {
    if (buttonRef && localButtonRef.current) {
      buttonRef.current = localButtonRef.current
    }
    return () => {
      if (buttonRef) {
        buttonRef.current = null
      }
    }
  }, [buttonRef])

  // Spring animation for dock transitions
  // We animate: x, y, width, height, scale, opacity, borderRadius, chromeOpacity
  // chromeOpacity controls the button "chrome" (border, background, shadow) - fades out when docking
  const [springStyles, springApi] = useSpring(() => ({
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    scale: 1,
    opacity: 1,
    borderRadius: 16,
    chromeOpacity: 1, // 1 = full button styling, 0 = no border/bg/shadow (docked look)
    config: { tension: 200, friction: 24 },
  }))

  // Start dock animation when dockAnimationState changes
  useEffect(() => {
    if (!dockAnimationState) return

    const { phase, fromRect, toRect, fromScale, toScale } = dockAnimationState

    // Set initial position
    // chromeOpacity: 1 = button look (border/bg/shadow), 0 = docked look (clean)
    springApi.set({
      x: fromRect.x,
      y: fromRect.y,
      width: fromRect.width,
      height: fromRect.height,
      scale: fromScale,
      opacity: 1,
      borderRadius: phase === 'docking' ? 16 : 8,
      chromeOpacity: phase === 'docking' ? 1 : 0, // Start with button look when docking, clean when undocking
    })

    // Animate to target position
    springApi.start({
      x: toRect.x,
      y: toRect.y,
      width: toRect.width,
      height: toRect.height,
      scale: toScale,
      opacity: 1,
      borderRadius: phase === 'docking' ? 8 : 16,
      chromeOpacity: phase === 'docking' ? 0 : 1, // Fade out chrome when docking, fade in when undocking
      config: { tension: 180, friction: 22 },
      onRest: () => {
        if (phase === 'docking') {
          completeDockAnimation()
        } else {
          completeUndockAnimation()
        }
      },
    })
  }, [dockAnimationState, springApi, completeDockAnimation, completeUndockAnimation])

  // Handler to initiate dock animation
  const handleDockClick = useCallback(() => {
    if (!dock?.element || !localButtonRef.current) {
      // Fallback to instant dock if we can't measure
      dockInto()
      return
    }

    // Measure the button's current position
    const buttonRect = localButtonRef.current.getBoundingClientRect()

    // Calculate the effective scale for the dock (auto-calculates if not explicit)
    const dockColumns = dock.columns ?? 5
    const targetScale = calculateEffectiveScaleFactor(dock.element, dockColumns, dock.scaleFactor)

    // Measure where the docked abacus will appear (renders temporarily to get accurate position)
    const targetRect = measureDockedAbacus(dock.element, dockColumns, targetScale, structuralStyles)

    // Calculate scales - button shows at 0.35 scale
    const buttonScale = 0.35

    const animState: DockAnimationState = {
      phase: 'docking',
      fromRect: {
        x: buttonRect.x,
        y: buttonRect.y,
        width: buttonRect.width,
        height: buttonRect.height,
      },
      toRect: targetRect,
      fromScale: buttonScale,
      toScale: targetScale,
    }

    startDockAnimation(animState)
  }, [dock, dockInto, structuralStyles, startDockAnimation, calculateEffectiveScaleFactor])

  // Handler to initiate undock animation
  const handleUndockClick = useCallback(() => {
    if (!dock?.element) {
      // Fallback to instant undock if we can't measure dock position
      undock()
      return
    }

    // Calculate the effective scale for the dock (same as what's currently displayed)
    const dockColumns = dock.columns ?? 5
    const dockScale = calculateEffectiveScaleFactor(dock.element, dockColumns, dock.scaleFactor)

    // The abacus is currently docked - find the actual rendered abacus element
    const dockedAbacus = dock.element.querySelector('[data-element="abacus-display"]')
    let sourceRect: { x: number; y: number; width: number; height: number }

    if (dockedAbacus) {
      // Measure the actual docked abacus position
      const rect = dockedAbacus.getBoundingClientRect()
      sourceRect = { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
    } else {
      // Fallback: measure what it would be
      sourceRect = measureDockedAbacus(dock.element, dockColumns, dockScale, structuralStyles)
    }

    // Calculate target button position (we don't need the ref - button has known fixed position)
    // Button is fixed at bottom-right with some margin
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const buttonSize = viewportWidth >= 768 ? 100 : 60
    const margin = viewportWidth >= 768 ? 24 : 16
    // Check if we're in landscape mode on a small screen (where keypad is on the right)
    const isLandscapeSmallScreen = window.matchMedia(
      '(orientation: landscape) and (max-height: 500px)'
    ).matches
    // In landscape small screen: rightOffset applies, bottomOffset doesn't
    // In portrait/large landscape: bottomOffset applies, rightOffset doesn't
    const effectiveRightOffset = isLandscapeSmallScreen ? rightOffset : 0
    const effectiveBottomOffset = isLandscapeSmallScreen ? 0 : bottomOffset
    const buttonX = viewportWidth - buttonSize - margin - effectiveRightOffset
    const buttonY = viewportHeight - buttonSize - margin - effectiveBottomOffset

    const buttonScale = 0.35

    const animState: DockAnimationState = {
      phase: 'undocking',
      fromRect: sourceRect,
      toRect: {
        x: buttonX,
        y: buttonY,
        width: buttonSize,
        height: buttonSize,
      },
      fromScale: dockScale,
      toScale: buttonScale,
    }

    startUndockAnimation(animState)
  }, [
    dock,
    undock,
    structuralStyles,
    startUndockAnimation,
    calculateEffectiveScaleFactor,
    bottomOffset,
    rightOffset,
  ])

  // Check if we're currently animating
  const isAnimating = dockAnimationState !== null

  // Hide completely when:
  // 1. isHidden is true (e.g., virtual keyboard is shown on non-game pages)
  // 2. On a game route and the game hasn't opted in to show it
  // 3. NOT docked (docked abacus should always show)
  // 4. NOT animating (animation layer should show)
  // Still allow open state to work (user explicitly opened it)
  // NOTE: This must come after all hooks to follow React's rules of hooks
  if (!isOpen && !isDocked && !isAnimating && (isHidden || (isOnGameRoute && !showInGame))) {
    return null
  }

  return (
    <>
      {/* Blur backdrop - only visible when open */}
      {isOpen && (
        <div
          data-component="my-abacus-backdrop"
          style={{
            WebkitBackdropFilter: 'blur(12px)',
          }}
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'rgba(0, 0, 0, 0.8)',
            backdropFilter: 'blur(12px)',
            zIndex: 101,
            animation: 'backdropFadeIn 0.4s ease-out',
          })}
          onClick={close}
        />
      )}

      {/* Close button - only visible when open */}
      {isOpen && (
        <button
          data-action="close-my-abacus"
          onClick={close}
          className={css({
            position: 'fixed',
            top: { base: '4', md: '8' },
            right: { base: '4', md: '8' },
            w: '12',
            h: '12',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(8px)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            borderRadius: 'full',
            color: 'white',
            fontSize: '2xl',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s',
            zIndex: 103,
            animation: 'fadeIn 0.3s ease-out 0.2s both',
            _hover: {
              bg: 'rgba(255, 255, 255, 0.2)',
              borderColor: 'rgba(255, 255, 255, 0.4)',
              transform: 'scale(1.1)',
            },
          })}
        >
          ×
        </button>
      )}

      {/* Docked mode: render directly into the dock container via portal */}
      {isDocked &&
        dock?.element &&
        createPortal(
          <div
            data-component="my-abacus"
            data-mode="docked"
            data-dock-id={dock.id}
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            })}
          >
            {/* Undock button - positioned at top-right of dock container */}
            <button
              data-action="undock-abacus"
              onClick={(e) => {
                e.stopPropagation()
                handleUndockClick()
              }}
              title="Undock abacus"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                margin: '4px',
              }}
              className={css({
                w: '24px',
                h: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bg: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 'md',
                color: 'white',
                fontSize: 'xs',
                cursor: 'pointer',
                transition: 'all 0.2s',
                zIndex: 10,
                opacity: 0.7,
                _hover: {
                  bg: 'rgba(0, 0, 0, 0.7)',
                  opacity: 1,
                  transform: 'scale(1.1)',
                },
              })}
            >
              ↗
            </button>
            <div
              data-element="abacus-display"
              className={css({
                filter: 'drop-shadow(0 4px 12px rgba(251, 191, 36, 0.2))',
              })}
            >
              <AbacusReact
                key="docked"
                value={dock.value ?? abacusValue}
                defaultValue={dock.defaultValue}
                columns={dock.columns ?? 5}
                scaleFactor={effectiveScaleFactor}
                beadShape={appConfig.beadShape}
                showNumbers={dock.showNumbers ?? true}
                interactive={dock.interactive ?? true}
                animated={dock.animated ?? true}
                customStyles={structuralStyles}
                onValueChange={(newValue: number | bigint) => {
                  const numValue = Number(newValue)
                  // Always update local state so abacus reflects the change
                  // (unless dock provides its own value prop for full control)
                  if (dock.value === undefined) {
                    setAbacusValue(numValue)
                  }
                  // Also call dock's callback if provided
                  if (dock.onValueChange) {
                    dock.onValueChange(numValue)
                  }
                }}
                enhanced3d="realistic"
                material3d={{
                  heavenBeads: 'glossy',
                  earthBeads: 'satin',
                  lighting: 'dramatic',
                  woodGrain: true,
                }}
              />
            </div>
          </div>,
          dock.element
        )}

      {/* Non-docked modes: hero, button, open */}
      {!isDocked && !isAnimating && (
        <div
          ref={localButtonRef}
          data-component="my-abacus"
          data-mode={isOpen ? 'open' : isHeroMode ? 'hero' : 'button'}
          data-dockable={isDockable ? 'true' : undefined}
          onClick={isOpen || isHeroMode ? undefined : isDockable ? handleDockClick : toggle}
          style={
            // In button mode, position with offset for on-screen keyboards
            // Portrait: bottomOffset moves button up
            // Landscape (small screens): rightOffset moves button left (handled via CSS media query below)
            !isOpen && !isHeroMode
              ? ({
                  // Set CSS custom properties for use in media queries
                  '--abacus-bottom-offset': `${bottomOffset}px`,
                  '--abacus-right-offset': `${rightOffset}px`,
                  bottom:
                    bottomOffset > 0
                      ? `calc(1rem + ${bottomOffset}px)` // base: 1rem (16px) + offset
                      : undefined,
                } as React.CSSProperties)
              : undefined
          }
          className={css({
            position: isHeroMode ? 'absolute' : 'fixed',
            zIndex: 102,
            cursor: isOpen || isHeroMode ? 'default' : 'pointer',
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            // Hide when printing
            _print: { display: 'none' },
            // Three modes: hero (absolute - scrolls with document), button (fixed), open (fixed)
            ...(isOpen
              ? {
                  // Open mode: fixed to center of viewport
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                }
              : isHeroMode
                ? {
                    // Hero mode: absolute positioning - scrolls naturally with document
                    top: '60vh',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }
                : {
                    // Button mode: fixed to bottom-right corner
                    // bottomOffset is added via inline style when needed, otherwise use CSS default
                    bottom: bottomOffset > 0 ? undefined : { base: '4', md: '6' },
                    right: { base: '4', md: '6' },
                    transform: 'translate(0, 0)',
                  }),
          })}
        >
          {/* Container that changes between hero, button, and open states */}
          <div
            className={css({
              transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
              ...(isOpen || isHeroMode
                ? {
                    // Open/Hero state: no background, just the abacus
                    bg: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    borderRadius: '0',
                  }
                : {
                    // Button state: button styling
                    // Use cyan/teal when dockable to indicate "dock me" state
                    bg: isDark ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.9)',
                    backdropFilter: 'blur(8px)',
                    border: isDockable
                      ? '3px solid rgba(34, 211, 238, 0.7)'
                      : isDark
                        ? '3px solid rgba(251, 191, 36, 0.5)'
                        : '3px solid rgba(251, 191, 36, 0.6)',
                    boxShadow: isDockable
                      ? '0 8px 32px rgba(34, 211, 238, 0.5)'
                      : isDark
                        ? '0 8px 32px rgba(251, 191, 36, 0.4)'
                        : '0 8px 32px rgba(251, 191, 36, 0.5)',
                    borderRadius: 'xl',
                    w: { base: '60px', md: '100px' },
                    h: { base: '60px', md: '100px' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    animation: isDockable
                      ? 'pulseDock 1.5s ease-in-out infinite'
                      : 'pulse 2s ease-in-out infinite',
                    _hover: {
                      transform: 'scale(1.1)',
                      boxShadow: isDockable
                        ? '0 12px 48px rgba(34, 211, 238, 0.7)'
                        : isDark
                          ? '0 12px 48px rgba(251, 191, 36, 0.6)'
                          : '0 12px 48px rgba(251, 191, 36, 0.7)',
                      borderColor: isDockable
                        ? 'rgba(34, 211, 238, 0.9)'
                        : 'rgba(251, 191, 36, 0.8)',
                    },
                  }),
            })}
          >
            {/* The abacus itself - same element, scales between hero/button/open */}
            <div
              data-element="abacus-display"
              className={css({
                transform: isOpen
                  ? { base: 'scale(2.5)', md: 'scale(3.5)', lg: 'scale(4.5)' }
                  : isHeroMode
                    ? { base: 'scale(3)', md: 'scale(3.5)', lg: 'scale(4.25)' }
                    : 'scale(0.35)',
                transformOrigin: 'center center',
                transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1), filter 0.6s ease',
                filter:
                  isOpen || isHeroMode
                    ? 'drop-shadow(0 10px 40px rgba(251, 191, 36, 0.3))'
                    : 'drop-shadow(0 4px 12px rgba(251, 191, 36, 0.2))',
                pointerEvents: isOpen || isHeroMode ? 'auto' : 'none',
              })}
            >
              <AbacusReact
                key={isHeroMode ? 'hero' : isOpen ? 'open' : 'closed'}
                value={abacusValue}
                columns={isHeroMode ? 4 : 5}
                beadShape={appConfig.beadShape}
                showNumbers={isOpen || isHeroMode}
                interactive={isOpen || isHeroMode}
                animated={isOpen || isHeroMode}
                customStyles={isHeroMode ? structuralStyles : trophyStyles}
                onValueChange={setAbacusValue}
                // 3D Enhancement - realistic mode for hero and open states
                enhanced3d={isOpen || isHeroMode ? 'realistic' : undefined}
                material3d={
                  isOpen || isHeroMode
                    ? {
                        heavenBeads: 'glossy',
                        earthBeads: 'satin',
                        lighting: 'dramatic',
                        woodGrain: true,
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </div>
      )}

      {/* Animation layer - fixed position overlay during dock/undock transitions */}
      {isAnimating && dockAnimationState && (
        <animated.div
          data-component="my-abacus-animation-layer"
          data-animation-phase={dockAnimationState.phase}
          style={{
            position: 'fixed',
            left: springStyles.x,
            top: springStyles.y,
            width: springStyles.width,
            height: springStyles.height,
            zIndex: 103,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // Animate background opacity based on chromeOpacity
            backgroundColor: springStyles.chromeOpacity.to((o) =>
              isDark ? `rgba(0, 0, 0, ${0.7 * o})` : `rgba(255, 255, 255, ${0.9 * o})`
            ),
            backdropFilter: springStyles.chromeOpacity.to((o) => `blur(${8 * o}px)`),
            WebkitBackdropFilter: springStyles.chromeOpacity.to((o) => `blur(${8 * o}px)`),
            // Animate border opacity
            border: springStyles.chromeOpacity.to((o) =>
              isDark
                ? `3px solid rgba(251, 191, 36, ${0.5 * o})`
                : `3px solid rgba(251, 191, 36, ${0.6 * o})`
            ),
            // Animate shadow opacity
            boxShadow: springStyles.chromeOpacity.to((o) =>
              isDark
                ? `0 8px 32px rgba(251, 191, 36, ${0.4 * o})`
                : `0 8px 32px rgba(251, 191, 36, ${0.5 * o})`
            ),
            borderRadius: springStyles.borderRadius,
            overflow: 'hidden',
          }}
        >
          {/* Inner container with scale transform */}
          <animated.div
            style={{
              transform: springStyles.scale.to((s) => `scale(${s})`),
              transformOrigin: 'center center',
              filter: 'drop-shadow(0 4px 12px rgba(251, 191, 36, 0.2))',
            }}
          >
            <AbacusReact
              key="animating"
              value={dock?.value ?? abacusValue}
              columns={dock?.columns ?? 5}
              beadShape={appConfig.beadShape}
              showNumbers={false}
              interactive={false}
              animated={false}
              customStyles={trophyStyles}
            />
          </animated.div>
        </animated.div>
      )}

      {/* Keyframes for animations */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes backdropFadeIn {
              from { opacity: 0; backdrop-filter: blur(0px); -webkit-backdrop-filter: blur(0px); }
              to { opacity: 1; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
            }
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes pulse {
              0%, 100% { box-shadow: 0 8px 32px rgba(251, 191, 36, 0.4); }
              50% { box-shadow: 0 12px 48px rgba(251, 191, 36, 0.6); }
            }
            @keyframes pulseDock {
              0%, 100% { box-shadow: 0 8px 32px rgba(34, 211, 238, 0.5); }
              50% { box-shadow: 0 12px 48px rgba(34, 211, 238, 0.8); }
            }
            /* Landscape mode on small screens: position abacus left of the right-side keypad */
            @media (orientation: landscape) and (max-height: 500px) {
              [data-component="my-abacus"][data-mode="button"] {
                right: calc(1rem + var(--abacus-right-offset, 0px)) !important;
                bottom: 1rem !important;
              }
            }
          `,
        }}
      />
    </>
  )
}
