'use client'

import type React from 'react'
import {
  createContext,
  type MutableRefObject,
  useCallback,
  useContext,
  useRef,
  useState,
} from 'react'

/**
 * Configuration for a docked abacus
 * Props align with AbacusReact from @soroban/abacus-react
 */
export interface DockConfig {
  /** The DOM element to render the abacus into */
  element: HTMLElement
  /** Optional identifier for debugging */
  id?: string
  /** Number of columns (default: 5) */
  columns?: number
  /** Whether the abacus is interactive (default: true) */
  interactive?: boolean
  /** Whether to show numbers below columns (default: true) */
  showNumbers?: boolean
  /** Whether to animate bead movements (default: true) */
  animated?: boolean
  /** Scale factor for the abacus (default: auto-fit to container) */
  scaleFactor?: number
  /** Whether the dock is currently visible in the viewport */
  isVisible?: boolean
  /** Controlled value - when provided, dock controls the abacus value */
  value?: number
  /** Default value for uncontrolled mode */
  defaultValue?: number
  /** Callback when value changes (for controlled mode) */
  onValueChange?: (newValue: number) => void
}

/**
 * Animation state for dock transitions
 */
export interface DockAnimationState {
  phase: 'docking' | 'undocking'
  /** Viewport rect of the starting position */
  fromRect: { x: number; y: number; width: number; height: number }
  /** Viewport rect of the target position */
  toRect: { x: number; y: number; width: number; height: number }
  /** Scale of the abacus at start */
  fromScale: number
  /** Scale of the abacus at end */
  toScale: number
}

interface MyAbacusContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /** Temporarily hide the abacus (e.g., when virtual keyboard is shown) */
  isHidden: boolean
  setIsHidden: (hidden: boolean) => void
  /** Bottom offset for abacus button (to position above on-screen keyboards in portrait) */
  bottomOffset: number
  setBottomOffset: (offset: number) => void
  /** Right offset for abacus button (to position left of on-screen keyboards in landscape) */
  rightOffset: number
  setRightOffset: (offset: number) => void
  /** Opt-in to show the abacus while in a game (games hide it by default) */
  showInGame: boolean
  setShowInGame: (show: boolean) => void
  /** Currently registered dock (if any) */
  dock: DockConfig | null
  /** Register a dock for the abacus to render into */
  registerDock: (config: DockConfig) => void
  /** Unregister a dock (should be called on unmount) */
  unregisterDock: (element: HTMLElement) => void
  /** Update dock visibility status */
  updateDockVisibility: (element: HTMLElement, isVisible: boolean) => void
  /** Whether the abacus is currently docked (user chose to dock it) */
  isDockedByUser: boolean
  /** Dock the abacus into the current dock */
  dockInto: () => void
  /** Undock the abacus (return to button mode) */
  undock: () => void
  /** Current dock animation state (null when not animating) */
  dockAnimationState: DockAnimationState | null
  /** Ref to the button element for measuring position */
  buttonRef: MutableRefObject<HTMLDivElement | null>
  /** Start the docking animation (called internally by MyAbacus when it measures rects) */
  startDockAnimation: (animState: DockAnimationState) => void
  /** Complete the docking animation (switches to docked state) */
  completeDockAnimation: () => void
  /** Start the undocking animation (called internally by MyAbacus when it measures rects) */
  startUndockAnimation: (animState: DockAnimationState) => void
  /** Complete the undocking animation (switches to button state) */
  completeUndockAnimation: () => void
}

const MyAbacusContext = createContext<MyAbacusContextValue | undefined>(undefined)

export function MyAbacusProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [bottomOffset, setBottomOffset] = useState(0)
  const [rightOffset, setRightOffset] = useState(0)
  const [showInGame, setShowInGame] = useState(false)
  const [dock, setDock] = useState<DockConfig | null>(null)
  const [isDockedByUser, setIsDockedByUser] = useState(false)
  const [dockAnimationState, setDockAnimationState] = useState<DockAnimationState | null>(null)
  const buttonRef = useRef<HTMLDivElement | null>(null)

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])
  const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

  const registerDock = useCallback((config: DockConfig) => {
    setDock(config)
  }, [])

  const unregisterDock = useCallback((element: HTMLElement) => {
    setDock((current) => {
      if (current?.element === element) {
        // Also undock if this dock is being removed
        setIsDockedByUser(false)
        return null
      }
      return current
    })
  }, [])

  const updateDockVisibility = useCallback((element: HTMLElement, isVisible: boolean) => {
    setDock((current) => {
      if (current?.element === element) {
        return { ...current, isVisible }
      }
      return current
    })
  }, [])

  const dockInto = useCallback(() => {
    if (dock) {
      setIsDockedByUser(true)
      setIsOpen(false)
    }
  }, [dock])

  const undock = useCallback(() => {
    setIsDockedByUser(false)
  }, [])

  // Animation callbacks
  const startDockAnimation = useCallback((animState: DockAnimationState) => {
    setDockAnimationState(animState)
  }, [])

  const completeDockAnimation = useCallback(() => {
    setDockAnimationState(null)
    setIsDockedByUser(true)
    setIsOpen(false)
  }, [])

  const startUndockAnimation = useCallback((animState: DockAnimationState) => {
    setDockAnimationState(animState)
    setIsDockedByUser(false) // Remove from portal immediately so we can animate the overlay
  }, [])

  const completeUndockAnimation = useCallback(() => {
    setDockAnimationState(null)
  }, [])

  return (
    <MyAbacusContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        isHidden,
        setIsHidden,
        bottomOffset,
        setBottomOffset,
        rightOffset,
        setRightOffset,
        showInGame,
        setShowInGame,
        dock,
        registerDock,
        unregisterDock,
        updateDockVisibility,
        isDockedByUser,
        dockInto,
        undock,
        dockAnimationState,
        buttonRef,
        startDockAnimation,
        completeDockAnimation,
        startUndockAnimation,
        completeUndockAnimation,
      }}
    >
      {children}
    </MyAbacusContext.Provider>
  )
}

export function useMyAbacus() {
  const context = useContext(MyAbacusContext)
  if (!context) {
    throw new Error('useMyAbacus must be used within MyAbacusProvider')
  }
  return context
}
