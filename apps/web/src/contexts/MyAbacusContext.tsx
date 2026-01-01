'use client'

import type React from 'react'
import {
  createContext,
  type MutableRefObject,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { CalibrationGrid } from '@/types/vision'

/**
 * Configuration for abacus vision (camera-based input)
 */
export interface VisionConfig {
  /** Whether vision mode is enabled */
  enabled: boolean
  /** Selected camera device ID */
  cameraDeviceId: string | null
  /** Saved calibration grid for cropping */
  calibration: CalibrationGrid | null
  /** Remote phone camera session ID (for phone-as-camera mode) */
  remoteCameraSessionId: string | null
}

const DEFAULT_VISION_CONFIG: VisionConfig = {
  enabled: false,
  cameraDeviceId: null,
  calibration: null,
  remoteCameraSessionId: null,
}

const VISION_CONFIG_STORAGE_KEY = 'abacus-vision-config'

/**
 * Load vision config from localStorage
 */
function loadVisionConfig(): VisionConfig {
  if (typeof window === 'undefined') return DEFAULT_VISION_CONFIG
  try {
    const stored = localStorage.getItem(VISION_CONFIG_STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      return {
        ...DEFAULT_VISION_CONFIG,
        ...parsed,
        // Always start with vision disabled - user must re-enable
        enabled: false,
      }
    }
  } catch (e) {
    console.error('[MyAbacusContext] Failed to load vision config:', e)
  }
  return DEFAULT_VISION_CONFIG
}

/**
 * Save vision config to localStorage
 */
function saveVisionConfig(config: VisionConfig): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(VISION_CONFIG_STORAGE_KEY, JSON.stringify(config))
  } catch (e) {
    console.error('[MyAbacusContext] Failed to save vision config:', e)
  }
}

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

/**
 * Vision frame data for broadcasting
 */
export interface VisionFrameData {
  /** Base64-encoded JPEG image data */
  imageData: string
  /** Detected abacus value (null if not yet detected) */
  detectedValue: number | null
  /** Detection confidence (0-1) */
  confidence: number
}

/**
 * Callback type for vision frame broadcasting
 */
export type VisionFrameCallback = (frame: VisionFrameData) => void

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
  /** Request to dock with animation (like clicking the MyAbacus button) */
  requestDock: () => void
  /** Pending dock request flag (MyAbacus watches this) */
  pendingDockRequest: boolean
  /** Clear the pending dock request (called by MyAbacus after handling) */
  clearDockRequest: () => void
  /** Set the value on the docked abacus (only works when docked) */
  setDockedValue: (value: number) => void
  /** Current abacus value (for reading) */
  abacusValue: number
  // Vision-related state
  /** Current vision configuration */
  visionConfig: VisionConfig
  /** Whether vision setup is complete (has camera and calibration) */
  isVisionSetupComplete: boolean
  /** Set whether vision is enabled */
  setVisionEnabled: (enabled: boolean) => void
  /** Set the selected camera device ID */
  setVisionCamera: (deviceId: string | null) => void
  /** Set the calibration grid */
  setVisionCalibration: (calibration: CalibrationGrid | null) => void
  /** Set the remote camera session ID */
  setVisionRemoteSession: (sessionId: string | null) => void
  /** Whether the vision setup modal is open */
  isVisionSetupOpen: boolean
  /** Open the vision setup modal */
  openVisionSetup: () => void
  /** Close the vision setup modal */
  closeVisionSetup: () => void
  /** Set a callback for receiving vision frames (for broadcasting to observers) */
  setVisionFrameCallback: (callback: VisionFrameCallback | null) => void
  /** Emit a vision frame (called by DockedVisionFeed) */
  emitVisionFrame: (frame: VisionFrameData) => void
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
  const [pendingDockRequest, setPendingDockRequest] = useState(false)
  const [abacusValue, setAbacusValue] = useState(0)

  // Vision state
  const [visionConfig, setVisionConfig] = useState<VisionConfig>(DEFAULT_VISION_CONFIG)
  const [isVisionSetupOpen, setIsVisionSetupOpen] = useState(false)

  // Load vision config from localStorage on mount
  useEffect(() => {
    const loaded = loadVisionConfig()
    setVisionConfig(loaded)
  }, [])

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

  // Request to dock with animation (triggers MyAbacus to animate into dock)
  const requestDock = useCallback(() => {
    if (dock) {
      setPendingDockRequest(true)
    }
  }, [dock])

  // Clear the pending dock request after MyAbacus handles it
  const clearDockRequest = useCallback(() => {
    setPendingDockRequest(false)
  }, [])

  // Set the value on the docked abacus
  const setDockedValue = useCallback((value: number) => {
    setAbacusValue(value)
  }, [])

  // Vision callbacks
  const isVisionSetupComplete =
    visionConfig.cameraDeviceId !== null && visionConfig.calibration !== null

  const setVisionEnabled = useCallback((enabled: boolean) => {
    setVisionConfig((prev) => {
      const updated = { ...prev, enabled }
      saveVisionConfig(updated)
      return updated
    })
  }, [])

  const setVisionCamera = useCallback((deviceId: string | null) => {
    setVisionConfig((prev) => {
      const updated = { ...prev, cameraDeviceId: deviceId }
      saveVisionConfig(updated)
      return updated
    })
  }, [])

  const setVisionCalibration = useCallback((calibration: CalibrationGrid | null) => {
    setVisionConfig((prev) => {
      const updated = { ...prev, calibration }
      saveVisionConfig(updated)
      return updated
    })
  }, [])

  const setVisionRemoteSession = useCallback((sessionId: string | null) => {
    setVisionConfig((prev) => {
      const updated = { ...prev, remoteCameraSessionId: sessionId }
      saveVisionConfig(updated)
      return updated
    })
  }, [])

  const openVisionSetup = useCallback(() => {
    console.log('[MyAbacusContext] openVisionSetup called')
    setIsVisionSetupOpen(true)
  }, [])
  const closeVisionSetup = useCallback(() => {
    console.log('[MyAbacusContext] closeVisionSetup called')
    setIsVisionSetupOpen(false)
  }, [])

  // Vision frame broadcasting
  const visionFrameCallbackRef = useRef<VisionFrameCallback | null>(null)

  const setVisionFrameCallback = useCallback((callback: VisionFrameCallback | null) => {
    visionFrameCallbackRef.current = callback
  }, [])

  const emitVisionFrame = useCallback((frame: VisionFrameData) => {
    visionFrameCallbackRef.current?.(frame)
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
        requestDock,
        pendingDockRequest,
        clearDockRequest,
        setDockedValue,
        abacusValue,
        // Vision
        visionConfig,
        isVisionSetupComplete,
        setVisionEnabled,
        setVisionCamera,
        setVisionCalibration,
        setVisionRemoteSession,
        isVisionSetupOpen,
        openVisionSetup,
        closeVisionSetup,
        setVisionFrameCallback,
        emitVisionFrame,
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
