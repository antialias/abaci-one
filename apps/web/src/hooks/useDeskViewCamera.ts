'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { DESK_VIEW_PATTERNS } from '@/types/vision'

export interface UseDeskViewCameraReturn {
  /** Whether camera is currently loading */
  isLoading: boolean
  /** Error message if camera failed */
  error: string | null
  /** Active video stream */
  videoStream: MediaStream | null
  /** Currently selected device */
  currentDevice: MediaDeviceInfo | null
  /** All available video input devices */
  availableDevices: MediaDeviceInfo[]
  /** Whether Desk View camera was auto-detected */
  isDeskViewDetected: boolean
  /** Current facing mode */
  facingMode: 'user' | 'environment'
  /** Whether torch is currently on */
  isTorchOn: boolean
  /** Whether torch is available on current device */
  isTorchAvailable: boolean

  /** Request camera access, optionally specifying device ID */
  requestCamera: (deviceId?: string) => Promise<void>
  /** Stop camera stream */
  stopCamera: () => void
  /** Refresh device list */
  enumerateDevices: () => Promise<MediaDeviceInfo[]>
  /** Flip between front and back camera */
  flipCamera: () => Promise<void>
  /** Toggle torch on/off */
  toggleTorch: () => Promise<void>
}

/**
 * Hook for managing camera access with Desk View auto-detection
 *
 * Prioritizes finding Apple's "Desk View" camera (via Continuity Camera),
 * but falls back to manual device selection if not available.
 */
export function useDeskViewCamera(): UseDeskViewCameraReturn {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [currentDevice, setCurrentDevice] = useState<MediaDeviceInfo | null>(null)
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([])
  const [isDeskViewDetected, setIsDeskViewDetected] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment')
  const [isTorchOn, setIsTorchOn] = useState(false)
  const [isTorchAvailable, setIsTorchAvailable] = useState(false)

  const streamRef = useRef<MediaStream | null>(null)
  const requestIdRef = useRef(0) // Track request ID to ignore stale completions
  const facingModeRef = useRef<'user' | 'environment'>('environment')

  /**
   * Enumerate available video input devices
   */
  const enumerateDevices = useCallback(async (): Promise<MediaDeviceInfo[]> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoInputs = devices.filter((d) => d.kind === 'videoinput')
      setAvailableDevices(videoInputs)
      return videoInputs
    } catch (err) {
      console.error('Failed to enumerate devices:', err)
      return []
    }
  }, [])

  /**
   * Check if a device label matches Desk View patterns
   */
  const isDeskViewDevice = useCallback((device: MediaDeviceInfo): boolean => {
    const label = device.label.toLowerCase()
    return DESK_VIEW_PATTERNS.some((pattern) => label.includes(pattern))
  }, [])

  /**
   * Find Desk View camera from device list
   */
  const findDeskViewCamera = useCallback(
    (devices: MediaDeviceInfo[]): MediaDeviceInfo | null => {
      for (const device of devices) {
        if (isDeskViewDevice(device)) {
          return device
        }
      }
      return null
    },
    [isDeskViewDevice]
  )

  /**
   * Check if torch is available on a video track
   */
  const checkTorchAvailability = useCallback((track: MediaStreamTrack): boolean => {
    try {
      const capabilities = track.getCapabilities() as MediaTrackCapabilities & {
        torch?: boolean
      }
      return capabilities.torch === true
    } catch {
      return false
    }
  }, [])

  /**
   * Apply torch setting to track
   */
  const applyTorch = useCallback(async (track: MediaStreamTrack, on: boolean): Promise<boolean> => {
    try {
      await track.applyConstraints({
        advanced: [{ torch: on } as MediaTrackConstraintSet],
      })
      return true
    } catch (err) {
      console.warn('[DeskViewCamera] Failed to apply torch:', err)
      return false
    }
  }, [])

  /**
   * Request camera access
   */
  const requestCamera = useCallback(
    async (deviceId?: string): Promise<void> => {
      const thisRequestId = ++requestIdRef.current
      setIsLoading(true)
      setError(null)

      try {
        // Stop any existing stream
        if (streamRef.current) {
          for (const track of streamRef.current.getTracks()) {
            track.stop()
          }
          streamRef.current = null
        }

        const devices = await enumerateDevices()

        // Check if this request is still the latest
        if (thisRequestId !== requestIdRef.current) return

        // If no deviceId specified, try to find Desk View
        let targetDeviceId = deviceId
        if (!targetDeviceId) {
          const deskViewDevice = findDeskViewCamera(devices)
          if (deskViewDevice) {
            targetDeviceId = deskViewDevice.deviceId
            setIsDeskViewDetected(true)
          } else {
            setIsDeskViewDetected(false)
          }
        }

        const constraints: MediaStreamConstraints = {
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1440 },
            // Try to disable face-tracking auto-focus (not all cameras support this)
            // @ts-expect-error - focusMode is valid but not in TS types
            focusMode: 'continuous',
            ...(targetDeviceId
              ? { deviceId: { exact: targetDeviceId } }
              : { facingMode: { ideal: facingModeRef.current } }),
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)

        // Check again if this request is still the latest
        if (thisRequestId !== requestIdRef.current) {
          for (const track of stream.getTracks()) {
            track.stop()
          }
          return
        }

        streamRef.current = stream
        setVideoStream(stream)

        // Find which device we got and check torch availability
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          const settings = videoTrack.getSettings()
          const matchingDevice = devices.find((d) => d.deviceId === settings.deviceId)
          if (matchingDevice) {
            setCurrentDevice(matchingDevice)
            setIsDeskViewDetected(isDeskViewDevice(matchingDevice))
          }

          // Check torch availability
          const torchAvailable = checkTorchAvailability(videoTrack)
          setIsTorchAvailable(torchAvailable)
          setIsTorchOn(false)
        }

        setIsLoading(false)
      } catch (err) {
        console.error('[DeskViewCamera] Failed to access camera:', err)
        setError(err instanceof Error ? err.message : 'Failed to access camera')
        setIsLoading(false)
      }
    },
    [enumerateDevices, findDeskViewCamera, isDeskViewDevice, checkTorchAvailability]
  )

  /**
   * Stop the camera stream
   */
  const stopCamera = useCallback(() => {
    requestIdRef.current++

    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop()
      }
      streamRef.current = null
    }
    setVideoStream(null)
    setCurrentDevice(null)
    setError(null)
    setIsTorchOn(false)
    setIsTorchAvailable(false)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        for (const track of streamRef.current.getTracks()) {
          track.stop()
        }
      }
    }
  }, [])

  // Listen for device changes (e.g., iPhone connected/disconnected)
  useEffect(() => {
    // Guard against SSR or unsupported environments
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return
    }

    const handleDeviceChange = () => {
      enumerateDevices()
    }

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
    }
  }, [enumerateDevices])

  /**
   * Flip between front and back camera
   */
  const flipCamera = useCallback(async () => {
    const newFacingMode = facingMode === 'user' ? 'environment' : 'user'
    facingModeRef.current = newFacingMode
    setFacingMode(newFacingMode)
    // Re-request camera with new facing mode (don't pass device ID to use facingMode)
    await requestCamera()
  }, [facingMode, requestCamera])

  /**
   * Toggle torch on/off
   */
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !isTorchAvailable) return

    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (!videoTrack) return

    const newState = !isTorchOn
    const success = await applyTorch(videoTrack, newState)
    if (success) {
      setIsTorchOn(newState)
    }
  }, [isTorchAvailable, isTorchOn, applyTorch])

  return {
    isLoading,
    error,
    videoStream,
    currentDevice,
    availableDevices,
    isDeskViewDetected,
    facingMode,
    isTorchOn,
    isTorchAvailable,
    requestCamera,
    stopCamera,
    enumerateDevices,
    flipCamera,
    toggleTorch,
  }
}
