'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useAbacusVision } from '@/hooks/useAbacusVision'
import { useRemoteCameraDesktop, type FrameMode } from '@/hooks/useRemoteCameraDesktop'
import type {
  CalibrationGrid,
  CalibrationMode,
  QuadCorners,
  UseAbacusVisionReturn,
} from '@/types/vision'

// ============================================================================
// Types
// ============================================================================

export type CameraSource = 'local' | 'phone'

export interface RemoteCameraState {
  /** Current session ID */
  sessionId: string | null
  /** Whether phone is connected to the session */
  isPhoneConnected: boolean
  /** Whether actively trying to reconnect */
  isReconnecting: boolean
  /** Latest frame from phone */
  latestFrame: {
    imageData: string
    timestamp: number
    mode?: FrameMode
    videoDimensions?: { width: number; height: number }
    detectedCorners?: QuadCorners | null
  } | null
  /** Current frame mode (raw for calibration, cropped for detection) */
  frameMode: FrameMode
  /** Video dimensions from phone (only in raw mode) */
  videoDimensions: { width: number; height: number } | null
  /** Corners detected by phone's marker detection */
  phoneDetectedCorners: QuadCorners | null
  /** Phone torch state */
  isTorchOn: boolean
  isTorchAvailable: boolean
  /** Frame rate */
  frameRate: number
  /** Connection error */
  error: string | null
}

export interface RemoteCameraActions {
  /** Subscribe to a session */
  subscribe: (sessionId: string) => void
  /** Unsubscribe from current session */
  unsubscribe: () => void
  /** Set phone frame mode */
  setPhoneFrameMode: (mode: FrameMode) => void
  /** Send calibration corners to phone */
  sendCalibration: (corners: QuadCorners) => void
  /** Clear calibration on phone */
  clearCalibration: () => void
  /** Toggle phone torch */
  setRemoteTorch: (on: boolean) => void
  /** Get persisted session ID */
  getPersistedSessionId: () => string | null
  /** Clear session and disconnect */
  clearSession: () => void
}

export interface CalibrationState {
  /** Whether currently in calibration mode */
  isCalibrating: boolean
  /** Current calibration grid */
  calibration: CalibrationGrid | null
  /** Whether calibration is complete */
  isCalibrated: boolean
  /** Current corners being edited (during calibration) */
  editingCorners: QuadCorners | null
  /** Current column dividers being edited */
  editingDividers: number[] | null
}

export interface CalibrationActions {
  /** Start calibration mode */
  startCalibration: () => void
  /** Finish calibration with the given grid */
  finishCalibration: (grid: CalibrationGrid) => void
  /** Cancel calibration without saving */
  cancelCalibration: () => void
  /** Update corners during calibration (for live preview) */
  setEditingCorners: (corners: QuadCorners) => void
  /** Update dividers during calibration */
  setEditingDividers: (dividers: number[]) => void
  /** Rotate corners 90 degrees */
  rotateCorners: (direction: 'left' | 'right') => void
  /** Reset to default calibration */
  resetCalibration: () => void
}

export interface AbacusVisionContextValue {
  // Camera source
  cameraSource: CameraSource
  setCameraSource: (source: CameraSource) => void

  // Column count
  columnCount: number
  setColumnCount: (count: number) => void

  // Local camera (full useAbacusVision return)
  localCamera: UseAbacusVisionReturn

  // Remote camera state and actions
  remoteCamera: RemoteCameraState & RemoteCameraActions

  // Remote calibration (separate from local)
  remoteCalibration: CalibrationState & CalibrationActions

  // Detection results (from whichever source is active)
  detection: {
    value: number | null
    confidence: number
    isStable: boolean
    consecutiveFrames: number
  }

  // Callbacks
  onValueDetected?: (value: number) => void
  onConfigurationChange?: (config: {
    columnCount?: number
    cameraSource?: CameraSource
    remoteCameraSessionId?: string | null
  }) => void
}

// ============================================================================
// Context
// ============================================================================

const AbacusVisionContext = createContext<AbacusVisionContextValue | null>(null)

// ============================================================================
// Hook
// ============================================================================

export function useAbacusVisionContext(): AbacusVisionContextValue {
  const context = useContext(AbacusVisionContext)
  if (!context) {
    throw new Error('useAbacusVisionContext must be used within AbacusVisionProvider')
  }
  return context
}

// ============================================================================
// Provider Props
// ============================================================================

export interface AbacusVisionProviderProps {
  children: ReactNode
  /** Initial column count */
  initialColumnCount?: number
  /** Initial camera source */
  initialCameraSource?: CameraSource
  /** Called when a stable value is detected */
  onValueDetected?: (value: number) => void
  /** Called when configuration changes */
  onConfigurationChange?: (config: {
    columnCount?: number
    cameraSource?: CameraSource
    remoteCameraSessionId?: string | null
  }) => void
}

// ============================================================================
// Provider
// ============================================================================

export function AbacusVisionProvider({
  children,
  initialColumnCount = 5,
  initialCameraSource = 'local',
  onValueDetected,
  onConfigurationChange,
}: AbacusVisionProviderProps) {
  // -------------------------------------------------------------------------
  // Core State
  // -------------------------------------------------------------------------
  const [cameraSource, setCameraSourceState] = useState<CameraSource>(initialCameraSource)
  const [columnCount, setColumnCountState] = useState(initialColumnCount)

  // -------------------------------------------------------------------------
  // Local Camera (via useAbacusVision)
  // -------------------------------------------------------------------------
  const localCamera = useAbacusVision({
    columnCount,
    onValueDetected: cameraSource === 'local' ? onValueDetected : undefined,
  })

  // -------------------------------------------------------------------------
  // Remote Camera (via useRemoteCameraDesktop)
  // -------------------------------------------------------------------------
  const remoteDesktop = useRemoteCameraDesktop()

  // Remote calibration state (managed separately from local)
  const [remoteIsCalibrating, setRemoteIsCalibrating] = useState(false)
  const [remoteCalibrationGrid, setRemoteCalibrationGrid] = useState<CalibrationGrid | null>(null)
  const [remoteEditingCorners, setRemoteEditingCorners] = useState<QuadCorners | null>(null)
  const [remoteEditingDividers, setRemoteEditingDividers] = useState<number[] | null>(null)

  // -------------------------------------------------------------------------
  // Camera Source Setter (with callback)
  // -------------------------------------------------------------------------
  const setCameraSource = useCallback(
    (source: CameraSource) => {
      setCameraSourceState(source)
      onConfigurationChange?.({ cameraSource: source })
    },
    [onConfigurationChange]
  )

  // -------------------------------------------------------------------------
  // Column Count Setter (with callback)
  // -------------------------------------------------------------------------
  const setColumnCount = useCallback(
    (count: number) => {
      setColumnCountState(count)
      onConfigurationChange?.({ columnCount: count })
    },
    [onConfigurationChange]
  )

  // -------------------------------------------------------------------------
  // Remote Calibration Actions
  // -------------------------------------------------------------------------
  const startRemoteCalibration = useCallback(() => {
    setRemoteIsCalibrating(true)
    // Tell phone to send raw (uncropped) frames for calibration
    remoteDesktop.setPhoneFrameMode('raw')
  }, [remoteDesktop])

  const finishRemoteCalibration = useCallback(
    (grid: CalibrationGrid) => {
      setRemoteCalibrationGrid(grid)
      setRemoteIsCalibrating(false)
      setRemoteEditingCorners(null)
      setRemoteEditingDividers(null)
      // Send calibration to phone - phone will auto-switch to cropped mode
      if (grid.corners) {
        remoteDesktop.sendCalibration(grid.corners)
      }
    },
    [remoteDesktop]
  )

  const cancelRemoteCalibration = useCallback(() => {
    setRemoteIsCalibrating(false)
    setRemoteEditingCorners(null)
    setRemoteEditingDividers(null)
    // If we had previous calibration, keep using it
    // Otherwise phone stays in raw mode
  }, [])

  const rotateRemoteCorners = useCallback((direction: 'left' | 'right') => {
    setRemoteEditingCorners((prev) => {
      if (!prev) return prev
      if (direction === 'right') {
        // Rotate 90 clockwise: TL->TR, TR->BR, BR->BL, BL->TL
        return {
          topLeft: prev.bottomLeft,
          topRight: prev.topLeft,
          bottomRight: prev.topRight,
          bottomLeft: prev.bottomRight,
        }
      } else {
        // Rotate 90 counter-clockwise
        return {
          topLeft: prev.topRight,
          topRight: prev.bottomRight,
          bottomRight: prev.bottomLeft,
          bottomLeft: prev.topLeft,
        }
      }
    })
  }, [])

  const resetRemoteCalibration = useCallback(() => {
    setRemoteCalibrationGrid(null)
    setRemoteEditingCorners(null)
    setRemoteEditingDividers(null)
    remoteDesktop.clearCalibration()
  }, [remoteDesktop])

  // -------------------------------------------------------------------------
  // Remote Camera State Object
  // -------------------------------------------------------------------------
  const remoteCameraState: RemoteCameraState & RemoteCameraActions = useMemo(
    () => ({
      // State
      sessionId: remoteDesktop.currentSessionId,
      isPhoneConnected: remoteDesktop.isPhoneConnected,
      isReconnecting: remoteDesktop.isReconnecting,
      latestFrame: remoteDesktop.latestFrame,
      frameMode: remoteDesktop.frameMode,
      videoDimensions: remoteDesktop.videoDimensions,
      phoneDetectedCorners: remoteDesktop.phoneDetectedCorners,
      isTorchOn: remoteDesktop.isTorchOn,
      isTorchAvailable: remoteDesktop.isTorchAvailable,
      frameRate: remoteDesktop.frameRate,
      error: remoteDesktop.error,
      // Actions
      subscribe: remoteDesktop.subscribe,
      unsubscribe: remoteDesktop.unsubscribe,
      setPhoneFrameMode: remoteDesktop.setPhoneFrameMode,
      sendCalibration: remoteDesktop.sendCalibration,
      clearCalibration: remoteDesktop.clearCalibration,
      setRemoteTorch: remoteDesktop.setRemoteTorch,
      getPersistedSessionId: remoteDesktop.getPersistedSessionId,
      clearSession: remoteDesktop.clearSession,
    }),
    [remoteDesktop]
  )

  // -------------------------------------------------------------------------
  // Remote Calibration State Object
  // -------------------------------------------------------------------------
  const remoteCalibrationState: CalibrationState & CalibrationActions = useMemo(
    () => ({
      // State
      isCalibrating: remoteIsCalibrating,
      calibration: remoteCalibrationGrid,
      isCalibrated: remoteCalibrationGrid !== null,
      editingCorners: remoteEditingCorners,
      editingDividers: remoteEditingDividers,
      // Actions
      startCalibration: startRemoteCalibration,
      finishCalibration: finishRemoteCalibration,
      cancelCalibration: cancelRemoteCalibration,
      setEditingCorners: setRemoteEditingCorners,
      setEditingDividers: setRemoteEditingDividers,
      rotateCorners: rotateRemoteCorners,
      resetCalibration: resetRemoteCalibration,
    }),
    [
      remoteIsCalibrating,
      remoteCalibrationGrid,
      remoteEditingCorners,
      remoteEditingDividers,
      startRemoteCalibration,
      finishRemoteCalibration,
      cancelRemoteCalibration,
      rotateRemoteCorners,
      resetRemoteCalibration,
    ]
  )

  // -------------------------------------------------------------------------
  // Detection Results (from active source)
  // -------------------------------------------------------------------------
  const detection = useMemo(
    () => ({
      value: cameraSource === 'local' ? localCamera.currentDetectedValue : null, // TODO: Add remote detection
      confidence: cameraSource === 'local' ? localCamera.confidence : 0,
      isStable: cameraSource === 'local' ? localCamera.consecutiveFrames >= 3 : false,
      consecutiveFrames: cameraSource === 'local' ? localCamera.consecutiveFrames : 0,
    }),
    [cameraSource, localCamera]
  )

  // -------------------------------------------------------------------------
  // Context Value
  // -------------------------------------------------------------------------
  const contextValue: AbacusVisionContextValue = useMemo(
    () => ({
      cameraSource,
      setCameraSource,
      columnCount,
      setColumnCount,
      localCamera,
      remoteCamera: remoteCameraState,
      remoteCalibration: remoteCalibrationState,
      detection,
      onValueDetected,
      onConfigurationChange,
    }),
    [
      cameraSource,
      setCameraSource,
      columnCount,
      setColumnCount,
      localCamera,
      remoteCameraState,
      remoteCalibrationState,
      detection,
      onValueDetected,
      onConfigurationChange,
    ]
  )

  return (
    <AbacusVisionContext.Provider value={contextValue}>{children}</AbacusVisionContext.Provider>
  )
}

export default AbacusVisionContext
