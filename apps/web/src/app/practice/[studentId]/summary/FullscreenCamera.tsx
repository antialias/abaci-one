'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentDetection } from '@/components/practice/useDocumentDetection'
import { ScannerControlsDrawer } from '@/components/practice/ScannerControlsDrawer'
import { useScannerSettings, useUpdateScannerSettings } from '@/hooks/useScannerSettings'
import type { QuadDetectorConfig } from '@/lib/vision/quadDetector'
import { css } from '../../../../../styled-system/css'

// Dynamic import for DocumentAdjuster (pulls in OpenCV)
const DocumentAdjuster = dynamic(
  () => import('@/components/practice/DocumentAdjuster').then((m) => m.DocumentAdjuster),
  { ssr: false }
)

// Lighting presets for different conditions
const LIGHTING_PRESETS = {
  normal: {
    label: 'Normal',
    icon: '☀️',
    config: {
      preprocessing: 'multi' as const,
      enableHistogramEqualization: true,
      enableAdaptiveThreshold: true,
      enableMorphGradient: true,
      cannyThresholds: [50, 150] as [number, number],
      adaptiveBlockSize: 11,
      adaptiveC: 2,
    },
  },
  lowLight: {
    label: 'Low Light',
    icon: '🌙',
    config: {
      preprocessing: 'multi' as const,
      enableHistogramEqualization: true,
      enableAdaptiveThreshold: true,
      enableMorphGradient: true,
      cannyThresholds: [30, 100] as [number, number],
      adaptiveBlockSize: 15,
      adaptiveC: 5,
    },
  },
  bright: {
    label: 'Bright',
    icon: '🔆',
    config: {
      preprocessing: 'enhanced' as const,
      enableHistogramEqualization: true,
      enableAdaptiveThreshold: false,
      enableMorphGradient: false,
      cannyThresholds: [80, 200] as [number, number],
      adaptiveBlockSize: 11,
      adaptiveC: 2,
    },
  },
}

// Analyze video frame to determine best preset
function analyzeFrameLighting(video: HTMLVideoElement): {
  preset: 'normal' | 'lowLight' | 'bright'
  brightness: number
  contrast: number
} {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) return { preset: 'normal', brightness: 128, contrast: 50 }

  // Sample at lower resolution for speed
  const sampleWidth = 160
  const sampleHeight = 120
  canvas.width = sampleWidth
  canvas.height = sampleHeight

  ctx.drawImage(video, 0, 0, sampleWidth, sampleHeight)
  const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
  const data = imageData.data

  // Calculate luminance for each pixel (simple average)
  let totalLuminance = 0
  const luminances: number[] = []
  const pixelCount = data.length / 4

  for (let i = 0; i < data.length; i += 4) {
    // Weighted luminance: 0.299*R + 0.587*G + 0.114*B
    const luminance = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    luminances.push(luminance)
    totalLuminance += luminance
  }

  const avgBrightness = totalLuminance / pixelCount

  // Calculate contrast (standard deviation)
  let varianceSum = 0
  for (const lum of luminances) {
    varianceSum += (lum - avgBrightness) ** 2
  }
  const contrast = Math.sqrt(varianceSum / pixelCount)

  // Determine preset based on metrics
  let preset: 'normal' | 'lowLight' | 'bright' = 'normal'

  if (avgBrightness < 70) {
    // Dark scene
    preset = 'lowLight'
  } else if (avgBrightness > 180 && contrast < 40) {
    // Bright and washed out
    preset = 'bright'
  } else if (avgBrightness > 160) {
    // Just bright
    preset = 'bright'
  }
  // Otherwise normal

  return { preset, brightness: avgBrightness, contrast }
}

interface FullscreenCameraProps {
  /** Called with cropped file, original file, corners, and rotation for later re-editing */
  onCapture: (
    croppedFile: File,
    originalFile: File,
    corners: Array<{ x: number; y: number }>,
    rotation: 0 | 90 | 180 | 270
  ) => void
  onClose: () => void
}

export function FullscreenCamera({ onCapture, onClose }: FullscreenCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const autoCaptureTriggeredRef = useRef(false)

  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)
  const [documentDetected, setDocumentDetected] = useState(false)

  // Camera controls state
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')

  // Preset selector state
  const [presetMode, setPresetMode] = useState<'auto' | 'normal' | 'lowLight' | 'bright'>('auto')
  const [detectedPreset, setDetectedPreset] = useState<'normal' | 'lowLight' | 'bright'>('normal')
  const [presetPopoverOpen, setPresetPopoverOpen] = useState(false)
  const [fingerOcclusionMode, setFingerOcclusionMode] = useState(false)

  // Adjustment mode state
  const [adjustmentMode, setAdjustmentMode] = useState<{
    sourceCanvas: HTMLCanvasElement
    corners: Array<{ x: number; y: number }>
  } | null>(null)

  // Advanced controls drawer state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const drawerSwipeRef = useRef<{ startX: number; startY: number } | null>(null)
  const settingsInitializedRef = useRef(false)

  // Load persisted scanner settings from database
  const { data: savedSettings } = useScannerSettings()
  const updateSettingsMutation = useUpdateScannerSettings()

  // Document detection hook (lazy loads OpenCV.js)
  const {
    isLoading: isScannerLoading,
    isReady: isScannerReady,
    ensureOpenCVLoaded,
    isStable: isDetectionStable,
    isLocked: isDetectionLocked,
    debugInfo: scannerDebugInfo,
    cv: opencvRef,
    getBestQuadCorners,
    captureSourceFrame,
    highlightDocument,
    detectQuadsInImage: detectQuadsInCamera,
    resetTracking,
    updateDetectorConfig,
    detectorConfig,
  } = useDocumentDetection()

  // Initialize detector config with saved settings when they load
  useEffect(() => {
    if (savedSettings && !settingsInitializedRef.current) {
      settingsInitializedRef.current = true
      updateDetectorConfig(savedSettings)
    }
  }, [savedSettings, updateDetectorConfig])

  // Handle config changes - update both local state and persist to database
  const handleConfigChange = useCallback(
    (newConfig: Partial<QuadDetectorConfig>) => {
      // Update local detector immediately for instant feedback
      updateDetectorConfig(newConfig)
      // Persist to database (uses optimistic update)
      updateSettingsMutation.mutate(newConfig)
    },
    [updateDetectorConfig, updateSettingsMutation]
  )

  // Apply preset config when preset mode or finger occlusion changes
  const applyPresetConfig = useCallback(
    (presetKey: 'normal' | 'lowLight' | 'bright') => {
      const preset = LIGHTING_PRESETS[presetKey]
      const config = { ...preset.config }

      // Add finger occlusion enhancements if enabled
      if (fingerOcclusionMode) {
        config.enableHoughLines = true
        config.enableMorphGradient = true
        // Slightly lower thresholds to catch partial edges
        config.cannyThresholds = [
          Math.max(20, config.cannyThresholds[0] - 15),
          Math.max(80, config.cannyThresholds[1] - 30),
        ] as [number, number]
      }

      updateDetectorConfig(config)
    },
    [fingerOcclusionMode, updateDetectorConfig]
  )

  // Analyze frame periodically when in auto mode
  useEffect(() => {
    if (presetMode !== 'auto' || !isReady || !videoRef.current || adjustmentMode) return

    const analyzeInterval = setInterval(() => {
      if (videoRef.current) {
        const analysis = analyzeFrameLighting(videoRef.current)
        if (analysis.preset !== detectedPreset) {
          setDetectedPreset(analysis.preset)
          applyPresetConfig(analysis.preset)
        }
      }
    }, 2000) // Analyze every 2 seconds

    // Initial analysis
    const analysis = analyzeFrameLighting(videoRef.current)
    setDetectedPreset(analysis.preset)
    applyPresetConfig(analysis.preset)

    return () => clearInterval(analyzeInterval)
  }, [presetMode, isReady, adjustmentMode, detectedPreset, applyPresetConfig])

  // Apply preset when manually selected
  useEffect(() => {
    if (presetMode !== 'auto') {
      applyPresetConfig(presetMode)
    }
  }, [presetMode, applyPresetConfig])

  // Reapply current preset when finger occlusion mode changes
  useEffect(() => {
    const currentPreset = presetMode === 'auto' ? detectedPreset : presetMode
    applyPresetConfig(currentPreset)
  }, [fingerOcclusionMode, presetMode, detectedPreset, applyPresetConfig])

  // Check for multiple cameras on mount
  useEffect(() => {
    const checkCameras = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const videoDevices = devices.filter((d) => d.kind === 'videoinput')
        setHasMultipleCameras(videoDevices.length > 1)
      } catch {
        // Ignore errors - just won't show flip button
      }
    }
    checkCameras()
  }, [])

  useEffect(() => {
    let cancelled = false

    const startCamera = async () => {
      try {
        // Start loading OpenCV in parallel with camera setup
        // (this component requires OpenCV for document detection)
        const opencvPromise = ensureOpenCVLoaded()

        const constraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints)

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        streamRef.current = stream

        // Check for torch capability
        const videoTrack = stream.getVideoTracks()[0]
        if (videoTrack) {
          const capabilities = videoTrack.getCapabilities?.()
          // @ts-expect-error - torch is not in the standard types but exists on mobile
          const hasTorch = capabilities?.torch === true
          setTorchAvailable(hasTorch)
          setTorchOn(false) // Reset torch state when camera changes
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          if (!cancelled) {
            setIsReady(true)
          }
        }

        // Wait for OpenCV to finish loading (should already be done or almost done)
        await opencvPromise
      } catch (err) {
        if (cancelled) return
        console.error('Camera access error:', err)
        setError('Camera access denied. Please allow camera access and try again.')
      }
    }

    startCamera()

    return () => {
      cancelled = true
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
    }
  }, [ensureOpenCVLoaded, facingMode])

  // Detection loop - runs when camera and scanner are ready, and NOT in adjustment mode
  useEffect(() => {
    // Don't run detection loop while in adjustment mode
    if (!isReady || !isScannerReady || adjustmentMode) return

    const video = videoRef.current
    const overlay = overlayCanvasRef.current
    if (!video || !overlay) return

    // Sync overlay canvas size with video
    const syncCanvasSize = () => {
      if (overlay && video) {
        overlay.width = video.clientWidth
        overlay.height = video.clientHeight
      }
    }
    syncCanvasSize()

    const detectLoop = () => {
      // Run detection every frame for smooth tracking
      // Detection typically takes ~8-10ms, well within 60fps budget
      if (video && overlay) {
        const detected = highlightDocument(video, overlay)
        setDocumentDetected(detected)
      }
      animationFrameRef.current = requestAnimationFrame(detectLoop)
    }

    // Start detection loop
    animationFrameRef.current = requestAnimationFrame(detectLoop)

    // Sync on resize
    window.addEventListener('resize', syncCanvasSize)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      window.removeEventListener('resize', syncCanvasSize)
    }
  }, [isReady, isScannerReady, highlightDocument, adjustmentMode])

  // Enter adjustment mode with captured frame and detected corners
  // Always shows the adjustment UI - uses fallback corners if no quad detected
  const enterAdjustmentMode = useCallback(() => {
    if (!videoRef.current) return

    const video = videoRef.current
    const sourceCanvas = captureSourceFrame(video)
    const detectedCorners = getBestQuadCorners()

    if (!sourceCanvas) return

    // Stop detection loop while adjusting
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Use detected corners if available, otherwise use full image bounds as fallback
    // This allows user to manually define crop area even when detection fails
    const corners = detectedCorners || [
      { x: 0, y: 0 },
      { x: sourceCanvas.width, y: 0 },
      { x: sourceCanvas.width, y: sourceCanvas.height },
      { x: 0, y: sourceCanvas.height },
    ]

    setAdjustmentMode({ sourceCanvas, corners })
  }, [captureSourceFrame, getBestQuadCorners])

  // Handle capture button - enters adjustment mode if document detected
  const capturePhoto = () => {
    if (isCapturing) return
    setIsCapturing(true)
    enterAdjustmentMode()
    setIsCapturing(false)
  }

  // Auto-capture when detection is locked and stable
  useEffect(() => {
    if (
      isDetectionLocked &&
      isReady &&
      isScannerReady &&
      !isCapturing &&
      !adjustmentMode &&
      !autoCaptureTriggeredRef.current
    ) {
      // Add a small delay to ensure stability
      const timeout = setTimeout(() => {
        if (isDetectionLocked && !autoCaptureTriggeredRef.current) {
          autoCaptureTriggeredRef.current = true
          console.log('Auto-capturing document...')
          enterAdjustmentMode()
        }
      }, 500) // 500ms delay after lock to ensure stability

      return () => clearTimeout(timeout)
    }
  }, [isDetectionLocked, isReady, isScannerReady, isCapturing, adjustmentMode, enterAdjustmentMode])

  // Handle adjustment confirm - pass cropped file, original file, corners, and rotation for later re-editing
  const handleAdjustmentConfirm = useCallback(
    async (
      croppedFile: File,
      corners: Array<{ x: number; y: number }>,
      rotation: 0 | 90 | 180 | 270
    ) => {
      if (!adjustmentMode) return

      // Convert source canvas to file for original preservation
      const originalBlob = await new Promise<Blob>((resolve, reject) => {
        adjustmentMode.sourceCanvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error('Failed to create original blob'))
          },
          'image/jpeg',
          0.95
        )
      })
      const originalFile = new File([originalBlob], `original-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })

      setAdjustmentMode(null)
      onCapture(croppedFile, originalFile, corners, rotation)
    },
    [onCapture, adjustmentMode]
  )

  // Handle adjustment cancel - return to camera
  // The detection loop will automatically restart via useEffect when adjustmentMode becomes null
  const handleAdjustmentCancel = useCallback(() => {
    setAdjustmentMode(null)
    autoCaptureTriggeredRef.current = false // Allow auto-capture again
    resetTracking() // Clear old quad detection state
  }, [resetTracking])

  // Show adjustment UI if in adjustment mode (overlay on top of camera)
  // Keep camera mounted but hidden to preserve video stream
  const showAdjuster = !!(adjustmentMode && opencvRef)

  // Toggle torch/flashlight
  const toggleTorch = useCallback(async () => {
    if (!streamRef.current || !torchAvailable) return

    const videoTrack = streamRef.current.getVideoTracks()[0]
    if (!videoTrack) return

    try {
      const newTorchState = !torchOn
      await videoTrack.applyConstraints({
        // @ts-expect-error - advanced torch constraint exists on mobile
        advanced: [{ torch: newTorchState }],
      })
      setTorchOn(newTorchState)
    } catch (err) {
      console.error('Failed to toggle torch:', err)
    }
  }, [torchAvailable, torchOn])

  // Flip between front and back camera
  const flipCamera = useCallback(() => {
    // Reset tracking and torch state before switching
    resetTracking()
    setTorchOn(false)
    setIsReady(false)
    setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))
  }, [resetTracking])

  // Swipe handlers for drawer
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0]
    // Only track swipes starting from left edge (first 30px)
    if (touch.clientX < 30) {
      drawerSwipeRef.current = { startX: touch.clientX, startY: touch.clientY }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!drawerSwipeRef.current) return
    const touch = e.touches[0]
    const deltaX = touch.clientX - drawerSwipeRef.current.startX
    const deltaY = Math.abs(touch.clientY - drawerSwipeRef.current.startY)

    // If swiping right and more horizontal than vertical, open drawer
    if (deltaX > 50 && deltaX > deltaY * 2) {
      setIsDrawerOpen(true)
      drawerSwipeRef.current = null
    }
  }, [])

  const handleTouchEnd = useCallback(() => {
    drawerSwipeRef.current = null
  }, [])

  return (
    <div
      data-component="fullscreen-camera"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className={css({
        position: 'absolute',
        inset: 0,
        bg: 'black',
      })}
    >
      {/* Always render video to keep stream alive */}
      <video
        ref={videoRef}
        playsInline
        muted
        className={css({
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          // Hide when in adjustment mode but keep mounted
          display: showAdjuster ? 'none' : 'block',
        })}
      />

      {/* Document adjuster overlay */}
      {showAdjuster && (
        <DocumentAdjuster
          sourceCanvas={adjustmentMode.sourceCanvas}
          initialCorners={adjustmentMode.corners}
          onConfirm={handleAdjustmentConfirm}
          onCancel={handleAdjustmentCancel}
          cv={opencvRef}
          detectQuadsInImage={detectQuadsInCamera}
        />
      )}

      {/* Camera UI - hidden when adjuster is shown */}
      {!showAdjuster && (
        <>
          {/* Overlay canvas for document detection visualization */}
          <canvas
            ref={overlayCanvasRef}
            className={css({
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none',
            })}
          />

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </>
      )}

      {!showAdjuster && !isReady && !error && (
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'black',
          })}
        >
          <div className={css({ color: 'white', fontSize: 'xl' })}>Starting camera...</div>
        </div>
      )}

      {!showAdjuster && error && (
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bg: 'black',
            p: 6,
          })}
        >
          <div
            className={css({
              color: 'red.400',
              fontSize: 'lg',
              textAlign: 'center',
              mb: 4,
            })}
          >
            {error}
          </div>
          <button
            type="button"
            onClick={onClose}
            className={css({
              px: 6,
              py: 3,
              bg: 'white',
              color: 'black',
              borderRadius: 'full',
              fontSize: 'lg',
              fontWeight: 'bold',
              cursor: 'pointer',
            })}
          >
            Close
          </button>
        </div>
      )}

      {!showAdjuster && !error && (
        <>
          {/* Top right controls */}
          <div
            data-element="top-controls"
            className={css({
              position: 'absolute',
              top: 4,
              right: 4,
              display: 'flex',
              gap: 2,
              zIndex: 10,
            })}
          >
            {/* Preset selector with popover */}
            <div className={css({ position: 'relative' })}>
              <button
                type="button"
                onClick={() => setPresetPopoverOpen(!presetPopoverOpen)}
                className={css({
                  height: '44px',
                  px: 3,
                  bg: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  borderRadius: 'full',
                  fontSize: 'sm',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  backdropFilter: 'blur(4px)',
                  _hover: { bg: 'rgba(0, 0, 0, 0.7)' },
                })}
                title="Lighting preset"
              >
                <span>
                  {presetMode === 'auto'
                    ? `🅰️ ${LIGHTING_PRESETS[detectedPreset].icon}`
                    : LIGHTING_PRESETS[presetMode].icon}
                </span>
                <span className={css({ fontSize: 'xs' })}>
                  {presetMode === 'auto' ? 'Auto' : LIGHTING_PRESETS[presetMode].label}
                </span>
              </button>

              {/* Popover */}
              {presetPopoverOpen && (
                <>
                  {/* Backdrop to close popover */}
                  <div
                    onClick={() => setPresetPopoverOpen(false)}
                    className={css({
                      position: 'fixed',
                      inset: 0,
                      zIndex: 5,
                    })}
                  />
                  <div
                    data-element="preset-popover"
                    className={css({
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      mt: 2,
                      bg: 'rgba(0, 0, 0, 0.9)',
                      backdropFilter: 'blur(8px)',
                      borderRadius: 'lg',
                      border: '1px solid',
                      borderColor: 'rgba(255, 255, 255, 0.2)',
                      overflow: 'hidden',
                      zIndex: 10,
                      minWidth: '140px',
                    })}
                  >
                    {/* Auto option */}
                    <button
                      type="button"
                      onClick={() => {
                        setPresetMode('auto')
                        setPresetPopoverOpen(false)
                      }}
                      className={css({
                        width: '100%',
                        px: 3,
                        py: 2,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        bg: presetMode === 'auto' ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                        color: 'white',
                        fontSize: 'sm',
                        cursor: 'pointer',
                        _hover: { bg: 'rgba(255, 255, 255, 0.1)' },
                      })}
                    >
                      <span>🅰️</span>
                      <span>Auto</span>
                      {presetMode === 'auto' && (
                        <span
                          className={css({
                            ml: 'auto',
                            fontSize: 'xs',
                            color: 'blue.400',
                          })}
                        >
                          ✓
                        </span>
                      )}
                    </button>

                    {/* Divider */}
                    <div
                      className={css({
                        h: '1px',
                        bg: 'rgba(255, 255, 255, 0.1)',
                      })}
                    />

                    {/* Preset options */}
                    {(Object.keys(LIGHTING_PRESETS) as Array<keyof typeof LIGHTING_PRESETS>).map(
                      (key) => (
                        <button
                          type="button"
                          key={key}
                          onClick={() => {
                            setPresetMode(key)
                            setPresetPopoverOpen(false)
                          }}
                          className={css({
                            width: '100%',
                            px: 3,
                            py: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 2,
                            bg: presetMode === key ? 'rgba(59, 130, 246, 0.3)' : 'transparent',
                            color: 'white',
                            fontSize: 'sm',
                            cursor: 'pointer',
                            _hover: { bg: 'rgba(255, 255, 255, 0.1)' },
                          })}
                        >
                          <span>{LIGHTING_PRESETS[key].icon}</span>
                          <span>{LIGHTING_PRESETS[key].label}</span>
                          {presetMode === key && (
                            <span
                              className={css({
                                ml: 'auto',
                                fontSize: 'xs',
                                color: 'blue.400',
                              })}
                            >
                              ✓
                            </span>
                          )}
                          {presetMode === 'auto' && detectedPreset === key && (
                            <span
                              className={css({
                                ml: 'auto',
                                fontSize: '9px',
                                color: 'gray.400',
                              })}
                            >
                              detected
                            </span>
                          )}
                        </button>
                      )
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Finger occlusion mode toggle */}
            <button
              type="button"
              onClick={() => setFingerOcclusionMode(!fingerOcclusionMode)}
              className={css({
                width: '44px',
                height: '44px',
                bg: fingerOcclusionMode ? 'purple.600' : 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                borderRadius: 'full',
                fontSize: 'lg',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                transition: 'all 0.2s',
                _hover: {
                  bg: fingerOcclusionMode ? 'purple.500' : 'rgba(0, 0, 0, 0.7)',
                },
              })}
              title={fingerOcclusionMode ? 'Finger mode ON' : 'Finger mode OFF (experimental)'}
            >
              👆
            </button>

            {/* Torch toggle - only shown when available */}
            {torchAvailable && (
              <button
                type="button"
                onClick={toggleTorch}
                className={css({
                  width: '44px',
                  height: '44px',
                  bg: torchOn ? 'yellow.400' : 'rgba(0, 0, 0, 0.5)',
                  color: torchOn ? 'black' : 'white',
                  borderRadius: 'full',
                  fontSize: 'xl',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                  transition: 'all 0.2s',
                  _hover: { bg: torchOn ? 'yellow.300' : 'rgba(0, 0, 0, 0.7)' },
                })}
                title={torchOn ? 'Turn off flashlight' : 'Turn on flashlight'}
              >
                {torchOn ? '🔦' : '💡'}
              </button>
            )}

            {/* Camera flip - only shown when multiple cameras */}
            {hasMultipleCameras && (
              <button
                type="button"
                onClick={flipCamera}
                className={css({
                  width: '44px',
                  height: '44px',
                  bg: 'rgba(0, 0, 0, 0.5)',
                  color: 'white',
                  borderRadius: 'full',
                  fontSize: 'xl',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(4px)',
                  _hover: { bg: 'rgba(0, 0, 0, 0.7)' },
                })}
                title="Flip camera"
              >
                🔄
              </button>
            )}

            {/* Close button */}
            <button
              type="button"
              onClick={onClose}
              className={css({
                width: '44px',
                height: '44px',
                bg: 'rgba(0, 0, 0, 0.5)',
                color: 'white',
                borderRadius: 'full',
                fontSize: '2xl',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                _hover: { bg: 'rgba(0, 0, 0, 0.7)' },
              })}
            >
              ×
            </button>
          </div>

          {/* Debug overlay panel - always shown to help diagnose detection */}
          <div
            data-element="scanner-debug-panel"
            className={css({
              position: 'absolute',
              top: 4,
              left: 4,
              p: 3,
              bg: 'rgba(0, 0, 0, 0.8)',
              backdropFilter: 'blur(4px)',
              borderRadius: 'lg',
              color: 'white',
              fontSize: 'xs',
              fontFamily: 'monospace',
              maxWidth: '280px',
              zIndex: 10,
            })}
          >
            <div
              className={css({
                fontWeight: 'bold',
                mb: 2,
                color: 'yellow.400',
              })}
            >
              Document Scanner Debug
            </div>
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
              })}
            >
              <div>
                Scanner:{' '}
                <span
                  className={css({
                    color: isScannerReady ? 'green.400' : 'orange.400',
                  })}
                >
                  {isScannerLoading ? 'Loading...' : isScannerReady ? 'Ready' : 'Failed'}
                </span>
              </div>
              <div>
                Camera:{' '}
                <span
                  className={css({
                    color: isReady ? 'green.400' : 'orange.400',
                  })}
                >
                  {isReady ? 'Ready' : 'Starting...'}
                </span>
              </div>
              <div>
                Document:{' '}
                <span
                  className={css({
                    color: isDetectionLocked
                      ? 'green.400'
                      : isDetectionStable
                        ? 'green.300'
                        : documentDetected
                          ? 'yellow.400'
                          : 'gray.400',
                  })}
                >
                  {isDetectionLocked
                    ? 'LOCKED'
                    : isDetectionStable
                      ? 'Stable'
                      : documentDetected
                        ? 'Unstable'
                        : 'Not detected'}
                </span>
              </div>
              <div>
                Quads: {scannerDebugInfo.quadsDetected} detected, {scannerDebugInfo.trackedQuads}{' '}
                tracked
              </div>
              <div>
                Best: {scannerDebugInfo.bestQuadFrameCount} frames,{' '}
                {Math.round(scannerDebugInfo.bestQuadStability * 100)}% stable
              </div>
              {scannerDebugInfo.loadTimeMs !== null && (
                <div>Load time: {scannerDebugInfo.loadTimeMs}ms</div>
              )}
              {scannerDebugInfo.lastDetectionMs !== null && (
                <div>Detection: {scannerDebugInfo.lastDetectionMs}ms</div>
              )}
              {scannerDebugInfo.lastDetectionError && (
                <div className={css({ color: 'red.400', wordBreak: 'break-word' })}>
                  Error: {scannerDebugInfo.lastDetectionError}
                </div>
              )}
            </div>
          </div>

          <div
            className={css({
              position: 'absolute',
              bottom: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
            })}
          >
            {/* Helper text for detection status */}
            <div
              data-element="detection-status"
              className={css({
                px: 4,
                py: 2,
                bg: 'rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(4px)',
                borderRadius: 'full',
                color: 'white',
                fontSize: 'sm',
                fontWeight: 'medium',
                textAlign: 'center',
                transition: 'all 0.2s',
              })}
            >
              {isScannerLoading ? (
                'Loading scanner...'
              ) : isDetectionLocked ? (
                <span className={css({ color: 'green.400', fontWeight: 'bold' })}>
                  ✓ Hold steady - Ready to capture!
                </span>
              ) : isDetectionStable ? (
                <span className={css({ color: 'green.300' })}>
                  Document detected - Hold steady...
                </span>
              ) : documentDetected ? (
                <span className={css({ color: 'yellow.400' })}>
                  Detecting... hold camera steady
                </span>
              ) : (
                'Point camera at document'
              )}
            </div>

            <button
              type="button"
              onClick={capturePhoto}
              disabled={isCapturing || !isReady}
              className={css({
                width: '80px',
                height: '80px',
                bg: 'white',
                borderRadius: 'full',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: isDetectionLocked
                  ? '0 4px 30px rgba(0, 255, 100, 0.5)'
                  : '0 4px 20px rgba(0, 0, 0, 0.3)',
                border: '4px solid',
                borderColor: isDetectionLocked
                  ? 'green.400'
                  : isDetectionStable
                    ? 'green.300'
                    : documentDetected
                      ? 'yellow.400'
                      : 'gray.300',
                transition: 'all 0.15s',
                _hover: { transform: 'scale(1.05)' },
                _active: { transform: 'scale(0.95)' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isCapturing ? (
                <div className={css({ fontSize: 'sm', color: 'gray.600' })}>...</div>
              ) : (
                <div
                  className={css({
                    width: '64px',
                    height: '64px',
                    bg: 'white',
                    borderRadius: 'full',
                    border: '2px solid',
                    borderColor: isDetectionLocked
                      ? 'green.400'
                      : isDetectionStable
                        ? 'green.300'
                        : documentDetected
                          ? 'yellow.400'
                          : 'gray.400',
                  })}
                />
              )}
            </button>
          </div>

          {/* Advanced controls drawer - swipe from left edge or click hint to open */}
          <ScannerControlsDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            onOpen={() => setIsDrawerOpen(true)}
            config={detectorConfig}
            onConfigChange={handleConfigChange}
          />
        </>
      )}
    </div>
  )
}

export default FullscreenCamera
