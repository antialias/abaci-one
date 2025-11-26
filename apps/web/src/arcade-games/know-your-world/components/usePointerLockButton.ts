import { useCallback, useEffect, useRef, useState } from 'react'

export interface ButtonBounds {
  left: number
  top: number
  right: number
  bottom: number
}

export interface PointerLockButtonOptions {
  /** Unique identifier for this button */
  id: string
  /** Whether the button is disabled */
  disabled?: boolean
  /** Whether the button should be active (e.g., visible/mounted) */
  active?: boolean
  /** Current pointer lock state */
  pointerLocked: boolean
  /** Current fake cursor position (relative to container) */
  cursorPosition: { x: number; y: number } | null
  /** Container ref for calculating relative bounds */
  containerRef: React.RefObject<HTMLElement | null>
  /** Callback when button is clicked via pointer lock */
  onClick: () => void
}

export interface PointerLockButtonResult {
  /** Ref callback to attach to the button element - updates bounds on mount/render */
  refCallback: (el: HTMLElement | null) => void
  /** Whether the fake cursor is currently hovering over this button */
  isHovered: boolean
  /** Current bounds of the button (relative to container) */
  bounds: ButtonBounds | null
  /** Check if a click at the given position would hit this button */
  checkClick: (x: number, y: number) => boolean
}

/**
 * Hook for making a button work with pointer lock mode.
 *
 * When pointer lock is active, normal click and hover events don't fire.
 * This hook tracks the button's bounds and checks if the fake cursor
 * is hovering over or clicking on the button.
 *
 * Usage:
 * ```tsx
 * const { refCallback, isHovered, checkClick } = usePointerLockButton({
 *   id: 'give-up',
 *   pointerLocked,
 *   cursorPosition,
 *   containerRef,
 *   onClick: handleGiveUp,
 * })
 *
 * return (
 *   <button
 *     ref={refCallback}
 *     style={{
 *       ...(isHovered ? { backgroundColor: 'yellow' } : {}),
 *     }}
 *   >
 *     Give Up
 *   </button>
 * )
 * ```
 */
export function usePointerLockButton(options: PointerLockButtonOptions): PointerLockButtonResult {
  const {
    disabled = false,
    active = true,
    pointerLocked,
    cursorPosition,
    containerRef,
    onClick,
  } = options

  const boundsRef = useRef<ButtonBounds | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  // Update bounds when button element changes
  const refCallback = useCallback(
    (el: HTMLElement | null) => {
      if (el && containerRef.current) {
        const buttonRect = el.getBoundingClientRect()
        const containerRect = containerRef.current.getBoundingClientRect()
        boundsRef.current = {
          left: buttonRect.left - containerRect.left,
          top: buttonRect.top - containerRect.top,
          right: buttonRect.right - containerRect.left,
          bottom: buttonRect.bottom - containerRect.top,
        }
      } else {
        boundsRef.current = null
      }
    },
    [containerRef]
  )

  // Check if a position is within bounds
  const isPositionInBounds = useCallback((x: number, y: number): boolean => {
    const bounds = boundsRef.current
    if (!bounds) return false
    return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom
  }, [])

  // Check if a click at position would hit this button
  const checkClick = useCallback(
    (x: number, y: number): boolean => {
      if (!active || disabled) return false
      return isPositionInBounds(x, y)
    },
    [active, disabled, isPositionInBounds]
  )

  // Update hover state when cursor moves (only in pointer lock mode)
  useEffect(() => {
    if (!pointerLocked || !active || !cursorPosition) {
      setIsHovered(false)
      return
    }

    const isOver = isPositionInBounds(cursorPosition.x, cursorPosition.y)
    setIsHovered(isOver)
  }, [pointerLocked, active, cursorPosition, isPositionInBounds])

  // Reset hover state when pointer lock is released
  useEffect(() => {
    if (!pointerLocked) {
      setIsHovered(false)
    }
  }, [pointerLocked])

  return {
    refCallback,
    isHovered: isHovered && !disabled,
    bounds: boundsRef.current,
    checkClick,
  }
}

/**
 * Registry for managing multiple pointer lock buttons.
 * The parent component can use this to check clicks against all registered buttons.
 */
export interface PointerLockButtonRegistry {
  /** Register a button with its click handler */
  register: (id: string, checkClick: (x: number, y: number) => boolean, onClick: () => void) => void
  /** Unregister a button */
  unregister: (id: string) => void
  /** Handle a click at the given position, returns true if a button was clicked */
  handleClick: (x: number, y: number) => boolean
}

/**
 * Hook for managing a registry of pointer lock buttons.
 * Use this in the parent component to handle clicks for all registered buttons.
 */
export function usePointerLockButtonRegistry(): PointerLockButtonRegistry {
  const buttonsRef = useRef<
    Map<string, { checkClick: (x: number, y: number) => boolean; onClick: () => void }>
  >(new Map())

  const register = useCallback(
    (id: string, checkClick: (x: number, y: number) => boolean, onClick: () => void) => {
      buttonsRef.current.set(id, { checkClick, onClick })
    },
    []
  )

  const unregister = useCallback((id: string) => {
    buttonsRef.current.delete(id)
  }, [])

  const handleClick = useCallback((x: number, y: number): boolean => {
    for (const [id, { checkClick, onClick }] of buttonsRef.current) {
      if (checkClick(x, y)) {
        console.log(`[CLICK] Button "${id}" clicked via pointer lock`)
        onClick()
        return true
      }
    }
    return false
  }, [])

  return { register, unregister, handleClick }
}
