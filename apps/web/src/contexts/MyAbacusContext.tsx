'use client'

import type React from 'react'
import { createContext, useContext, useState, useCallback } from 'react'

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

interface MyAbacusContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  toggle: () => void
  /** Temporarily hide the abacus (e.g., when virtual keyboard is shown) */
  isHidden: boolean
  setIsHidden: (hidden: boolean) => void
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
}

const MyAbacusContext = createContext<MyAbacusContextValue | undefined>(undefined)

export function MyAbacusProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isHidden, setIsHidden] = useState(false)
  const [showInGame, setShowInGame] = useState(false)
  const [dock, setDock] = useState<DockConfig | null>(null)
  const [isDockedByUser, setIsDockedByUser] = useState(false)

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

  return (
    <MyAbacusContext.Provider
      value={{
        isOpen,
        open,
        close,
        toggle,
        isHidden,
        setIsHidden,
        showInGame,
        setShowInGame,
        dock,
        registerDock,
        unregisterDock,
        updateDockVisibility,
        isDockedByUser,
        dockInto,
        undock,
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
