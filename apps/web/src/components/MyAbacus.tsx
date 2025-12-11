'use client'

import { useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { usePathname } from 'next/navigation'
import { AbacusReact, useAbacusConfig, ABACUS_THEMES } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { HomeHeroContext } from '@/contexts/HomeHeroContext'
import { useTheme } from '@/contexts/ThemeContext'

export function MyAbacus() {
  const { isOpen, close, toggle, isHidden, showInGame, dock, isDockedByUser, dockInto, undock } =
    useMyAbacus()
  const appConfig = useAbacusConfig()
  const pathname = usePathname()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Track dock container size for auto-scaling
  const [dockSize, setDockSize] = useState<{ width: number; height: number } | null>(null)

  // Sync with hero context if on home page
  const homeHeroContext = useContext(HomeHeroContext)
  const [localAbacusValue, setLocalAbacusValue] = useState(1234)
  const abacusValue = homeHeroContext?.abacusValue ?? localAbacusValue
  const setAbacusValue = homeHeroContext?.setAbacusValue ?? setLocalAbacusValue

  // Observe dock container size changes
  useEffect(() => {
    if (!dock?.element) {
      setDockSize(null)
      return
    }

    const element = dock.element
    const updateSize = () => {
      const rect = element.getBoundingClientRect()
      setDockSize({ width: rect.width, height: rect.height })
    }

    // Initial size
    updateSize()

    // Watch for size changes
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(element)

    return () => resizeObserver.disconnect()
  }, [dock?.element])

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

  // Detect if we're on a game route (arcade games hide the abacus by default)
  // This matches /arcade, /arcade/*, and /arcade-rooms/*
  const isOnGameRoute = pathname?.startsWith('/arcade')

  // Calculate scale factor for docked mode
  // Base abacus dimensions are approximately 120px wide per column, 200px tall
  const calculateDockedScale = () => {
    if (!dockSize || !dock) return 1
    if (dock.scaleFactor) return dock.scaleFactor

    const columns = dock.columns ?? 5
    // Approximate base dimensions of AbacusReact at scale 1
    const baseWidth = columns * 24 + 20 // ~24px per column + padding
    const baseHeight = 55 // approximate height

    const scaleX = dockSize.width / baseWidth
    const scaleY = dockSize.height / baseHeight
    // Use the smaller scale to fit within container, with some padding
    return Math.min(scaleX, scaleY) * 0.85
  }

  const dockedScale = calculateDockedScale()

  // Hide completely when:
  // 1. isHidden is true (e.g., virtual keyboard is shown on non-game pages)
  // 2. On a game route and the game hasn't opted in to show it
  // 3. NOT docked (docked abacus should always show)
  // Still allow open state to work (user explicitly opened it)
  // NOTE: This must come after all hooks to follow React's rules of hooks
  if (!isOpen && !isDocked && (isHidden || (isOnGameRoute && !showInGame))) {
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
              width: '100%',
              height: '100%',
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
                undock()
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
              style={{ transform: `scale(${dockedScale})` }}
              className={css({
                transformOrigin: 'center center',
                transition: 'transform 0.3s ease',
                filter: 'drop-shadow(0 4px 12px rgba(251, 191, 36, 0.2))',
              })}
            >
              <AbacusReact
                key="docked"
                value={dock.value ?? abacusValue}
                defaultValue={dock.defaultValue}
                columns={dock.columns ?? 5}
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
      {!isDocked && (
        <div
          data-component="my-abacus"
          data-mode={isOpen ? 'open' : isHeroMode ? 'hero' : 'button'}
          data-dockable={isDockable ? 'true' : undefined}
          onClick={isOpen || isHeroMode ? undefined : isDockable ? dockInto : toggle}
          className={css({
            position: isHeroMode ? 'absolute' : 'fixed',
            zIndex: 102,
            cursor: isOpen || isHeroMode ? 'default' : 'pointer',
            transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
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
                    bottom: { base: '4', md: '6' },
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
                    w: { base: '80px', md: '100px' },
                    h: { base: '80px', md: '100px' },
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
          `,
        }}
      />
    </>
  )
}
