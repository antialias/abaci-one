/**
 * Magnifier Controls Component
 *
 * Mobile control buttons for the magnifier overlay:
 * - Select button: Selects the region under the crosshairs
 * - Full Map button: Exits expanded mode back to normal magnifier
 * - Expand button: Expands magnifier to fill available space
 */

'use client'

import { memo, type TouchEvent as ReactTouchEvent, type MouseEvent as ReactMouseEvent } from 'react'

// ============================================================================
// Types
// ============================================================================

export interface MagnifierControlsProps {
  /** Whether device is touch-based */
  isTouchDevice: boolean
  /** Whether magnifier was triggered by mobile drag (shows Select button) */
  showSelectButton: boolean
  /** Whether magnifier is expanded to fill space */
  isExpanded: boolean
  /** Whether Select button should be disabled (no region or already found) */
  isSelectDisabled: boolean
  /** Whether dark mode is active */
  isDark: boolean
  /** Whether pointer is locked (hides expand button when true) */
  pointerLocked?: boolean
  /** Called when Select button is pressed */
  onSelect: () => void
  /** Called when Full Map button is pressed (exit expanded mode) */
  onExitExpanded: () => void
  /** Called when Expand button is pressed */
  onExpand: () => void
}

// ============================================================================
// Sub-components
// ============================================================================

interface ControlButtonProps {
  position: 'top-right' | 'bottom-right' | 'bottom-left'
  disabled?: boolean
  style?: 'select' | 'secondary' | 'icon'
  onClick: () => void
  children: React.ReactNode
}

/**
 * Base button component for magnifier controls
 */
function ControlButton({
  position,
  disabled = false,
  style = 'secondary',
  onClick,
  children,
}: ControlButtonProps) {
  const handleTouchStart = (e: ReactTouchEvent) => {
    e.stopPropagation()
  }

  const handleTouchEnd = (e: ReactTouchEvent) => {
    e.stopPropagation()
    e.preventDefault()
    if (!disabled) onClick()
  }

  const handleClick = (e: ReactMouseEvent) => {
    e.stopPropagation()
    if (!disabled) onClick()
  }

  // Position styles
  const positionStyles: Record<string, React.CSSProperties> = {
    'top-right': { top: '8px', right: '8px' },
    'bottom-right': { bottom: 0, right: 0 },
    'bottom-left': { bottom: 0, left: 0 },
  }

  // Border radius based on position
  const borderRadiusStyles: Record<string, React.CSSProperties> = {
    'top-right': { borderRadius: '6px' },
    'bottom-right': { borderTopLeftRadius: '12px', borderBottomRightRadius: '10px' },
    'bottom-left': { borderTopRightRadius: '12px', borderBottomLeftRadius: '10px' },
  }

  // Style-specific colors and backgrounds
  const styleVariants = {
    select: {
      enabled: {
        background: 'linear-gradient(135deg, #22c55e, #16a34a)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3)',
      },
      disabled: {
        background: 'linear-gradient(135deg, #9ca3af, #6b7280)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
      },
    },
    secondary: {
      enabled: {
        background: 'linear-gradient(135deg, #6b7280, #4b5563)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
      },
      disabled: {
        background: 'linear-gradient(135deg, #9ca3af, #6b7280)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)',
      },
    },
    icon: {
      enabled: {
        background: 'rgba(31, 41, 55, 0.9)',
        boxShadow: 'none',
      },
      disabled: {
        background: 'rgba(31, 41, 55, 0.9)',
        boxShadow: 'none',
      },
    },
  }

  const variantStyle = disabled ? styleVariants[style].disabled : styleVariants[style].enabled

  return (
    <button
      type="button"
      disabled={disabled}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
      style={{
        position: 'absolute',
        ...positionStyles[position],
        ...borderRadiusStyles[position],
        padding: style === 'icon' ? 0 : '10px 20px',
        width: style === 'icon' ? '28px' : undefined,
        height: style === 'icon' ? '28px' : undefined,
        display: style === 'icon' ? 'flex' : undefined,
        alignItems: style === 'icon' ? 'center' : undefined,
        justifyContent: style === 'icon' ? 'center' : undefined,
        ...variantStyle,
        border: 'none',
        color: 'white',
        fontSize: '14px',
        fontWeight: 'bold',
        cursor: disabled ? 'not-allowed' : 'pointer',
        touchAction: 'none',
        opacity: disabled ? 0.7 : 1,
      }}
    >
      {children}
    </button>
  )
}

// ============================================================================
// Expand Icon
// ============================================================================

function ExpandIcon({ isDark }: { isDark: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke={isDark ? '#60a5fa' : '#3b82f6'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  )
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * Magnifier control buttons for touch devices.
 *
 * Layout:
 * - Expand button: top-right (when not expanded)
 * - Select button: bottom-right (when visible)
 * - Full Map button: bottom-left (when expanded)
 */
export const MagnifierControls = memo(function MagnifierControls({
  isTouchDevice,
  showSelectButton,
  isExpanded,
  isSelectDisabled,
  isDark,
  pointerLocked = false,
  onSelect,
  onExitExpanded,
  onExpand,
}: MagnifierControlsProps) {
  // Only render on touch devices
  if (!isTouchDevice) {
    return null
  }

  return (
    <>
      {/* Expand button - top-right corner (when not expanded and not pointer locked) */}
      {!isExpanded && !pointerLocked && (
        <ControlButton position="top-right" style="icon" onClick={onExpand}>
          <ExpandIcon isDark={isDark} />
        </ControlButton>
      )}

      {/* Select button - bottom-right corner (when triggered by drag) */}
      {showSelectButton && (
        <ControlButton
          position="bottom-right"
          style="select"
          disabled={isSelectDisabled}
          onClick={onSelect}
        >
          Select
        </ControlButton>
      )}

      {/* Full Map button - bottom-left corner (when expanded) */}
      {isExpanded && showSelectButton && (
        <ControlButton position="bottom-left" style="secondary" onClick={onExitExpanded}>
          Full Map
        </ControlButton>
      )}
    </>
  )
})
