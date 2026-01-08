'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AbacusReact } from '@soroban/abacus-react'
import { useMyAbacus } from '@/contexts/MyAbacusContext'
import { useFrameStability } from '@/hooks/useFrameStability'
import { useMarkerDetection } from '@/hooks/useMarkerDetection'
import { useRemoteCameraDesktop } from '@/hooks/useRemoteCameraDesktop'
import { useColumnClassifier } from '@/hooks/useColumnClassifier'
import { processVideoFrame, processImageFrame, digitsToNumber } from '@/lib/vision/frameProcessor'
import { VisionCameraFeed } from './VisionCameraFeed'
import { css } from '../../../styled-system/css'

/**
 * Feature flag: Enable automatic abacus value detection from video feed.
 *
 * When enabled:
 * - Runs ML-based digit classification on video frames
 * - Shows detected value overlay
 * - Calls setDockedValue and onValueDetected with detected values
 *
 * When disabled:
 * - Only shows the video feed (no detection)
 * - Hides the detection overlay
 * - Does not interfere with student's manual input
 */
const ENABLE_AUTO_DETECTION = true

interface DockedVisionFeedProps {
  /** Called when a stable value is detected */
  onValueDetected?: (value: number) => void
  /** Number of columns to detect */
  columnCount?: number
  /** Called when user wants to undock the abacus */
  onUndock?: () => void
}

/**
 * Renders the processed camera feed in place of the docked abacus
 *
 * When vision is enabled in MyAbacusContext, this component:
 * - For local camera: Opens the saved camera, applies calibration, runs detection
 * - For remote camera: Receives frames from phone, runs detection
 * - Shows the video feed with detection overlay
 */
export function DockedVisionFeed({ onValueDetected, columnCount = 5, onUndock }: DockedVisionFeedProps) {
  const {
    visionConfig,
    setDockedValue,
    setVisionEnabled,
    setVisionCalibration,
    emitVisionFrame,
    visionSourceRef,
  } = useMyAbacus()

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const remoteImageRef = useRef<HTMLImageElement>(null)
  const rectifiedCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastInferenceTimeRef = useRef<number>(0)
  const lastBroadcastTimeRef = useRef<number>(0)
  const isInferringRef = useRef(false) // Prevent concurrent inference

  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [detectedValue, setDetectedValue] = useState<number | null>(null)
  const [confidence, setConfidence] = useState(0)
  const [columnDigits, setColumnDigits] = useState<number[]>([])
  const [showAbacusMirror, setShowAbacusMirror] = useState(false)
  // Show a subtle recommendation to try mirror mode when detection is working well
  const [showMirrorHint, setShowMirrorHint] = useState(false)
  // Track if user has dismissed the hint or engaged with mirror mode
  const hintDismissedRef = useRef(false)

  // Track video element in state for marker detection hook
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null)

  // ML column classifier hook
  const classifier = useColumnClassifier()

  // Preload the ML model when component mounts
  useEffect(() => {
    if (ENABLE_AUTO_DETECTION) {
      classifier.preload()
    }
  }, [classifier])

  // Stability tracking for detected values (hook must be called unconditionally)
  const stability = useFrameStability()

  // Determine camera source from explicit activeCameraSource field
  const isLocalCamera = visionConfig.activeCameraSource === 'local'
  const isRemoteCamera = visionConfig.activeCameraSource === 'phone'

  // ArUco marker detection using shared hook
  const { markersFound } = useMarkerDetection({
    enabled: visionConfig.enabled && isLocalCamera && videoStream !== null,
    videoElement,
    columnCount,
    onCalibrationChange: setVisionCalibration,
  })

  // Remote camera hook
  const {
    isPhoneConnected: remoteIsPhoneConnected,
    latestFrame: remoteLatestFrame,
    subscribe: remoteSubscribe,
    unsubscribe: remoteUnsubscribe,
  } = useRemoteCameraDesktop()

  const INFERENCE_INTERVAL_MS = 100 // 10fps

  // Start local camera when component mounts (only for local camera)
  useEffect(() => {
    if (!visionConfig.enabled || !isLocalCamera || !visionConfig.cameraDeviceId) {
      return
    }

    let cancelled = false
    setIsLoading(true)
    setError(null)

    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: visionConfig.cameraDeviceId! },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        })

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        setVideoStream(stream)
        setIsLoading(false)
      } catch (err) {
        if (cancelled) return
        console.error('[DockedVisionFeed] Failed to start camera:', err)
        setError('Failed to access camera')
        setIsLoading(false)
      }
    }

    startCamera()

    return () => {
      cancelled = true
    }
  }, [visionConfig.enabled, isLocalCamera, visionConfig.cameraDeviceId])

  // Stop camera when stream changes or component unmounts
  useEffect(() => {
    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [videoStream])

  // Attach stream to video element
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream
    }
  }, [videoStream])

  // Register vision source for training data capture
  // Note: We depend on remoteLatestFrame because the <img> element only renders when we have a frame,
  // so remoteImageRef.current is null until the first frame arrives
  useEffect(() => {
    if (isLocalCamera && videoRef.current && videoStream) {
      visionSourceRef.current = { type: 'video', element: videoRef.current }
    } else if (
      isRemoteCamera &&
      remoteImageRef.current &&
      remoteIsPhoneConnected &&
      remoteLatestFrame
    ) {
      visionSourceRef.current = { type: 'image', element: remoteImageRef.current }
    }

    return () => {
      // Clear the source ref when this component unmounts
      visionSourceRef.current = null
    }
  }, [
    isLocalCamera,
    isRemoteCamera,
    videoStream,
    remoteIsPhoneConnected,
    remoteLatestFrame,
    visionSourceRef,
  ])

  // Subscribe to remote camera session
  useEffect(() => {
    if (!visionConfig.enabled || !isRemoteCamera || !visionConfig.remoteCameraSessionId) {
      return
    }

    setIsLoading(true)
    remoteSubscribe(visionConfig.remoteCameraSessionId)

    return () => {
      remoteUnsubscribe()
    }
  }, [
    visionConfig.enabled,
    isRemoteCamera,
    visionConfig.remoteCameraSessionId,
    remoteSubscribe,
    remoteUnsubscribe,
  ])

  // Update loading state when remote camera connects
  useEffect(() => {
    if (isRemoteCamera && remoteIsPhoneConnected) {
      setIsLoading(false)
    }
  }, [isRemoteCamera, remoteIsPhoneConnected])

  // Process local camera frames for detection (only when enabled)
  const processLocalFrame = useCallback(async () => {
    // Skip detection when feature is disabled or model not ready
    if (!ENABLE_AUTO_DETECTION) return
    if (!classifier.isModelLoaded) return
    if (isInferringRef.current) return // Skip if already inferring

    const now = performance.now()
    if (now - lastInferenceTimeRef.current < INFERENCE_INTERVAL_MS) {
      return
    }
    lastInferenceTimeRef.current = now

    const video = videoRef.current
    if (!video || video.readyState < 2) return
    if (!visionConfig.calibration) return

    isInferringRef.current = true

    try {
      // Process video frame into column strips
      const columnImages = processVideoFrame(video, visionConfig.calibration)
      if (columnImages.length === 0) return

      // Use ML-based digit classification
      const results = await classifier.classifyColumns(columnImages)
      if (!results || results.digits.length === 0) return

      // Extract digits and minimum confidence
      const { digits, confidences } = results
      const minConfidence = Math.min(...confidences)

      // Store column digits for AbacusMirror display
      setColumnDigits(digits)

      // Convert to number
      const value = digitsToNumber(digits)

      // Push to stability buffer
      stability.pushFrame(value, minConfidence)
    } finally {
      isInferringRef.current = false
    }
  }, [visionConfig.calibration, stability, classifier])

  // Process remote camera frames for detection (only when enabled)
  useEffect(() => {
    // Skip detection when feature is disabled or model not ready
    if (!ENABLE_AUTO_DETECTION) return
    if (!classifier.isModelLoaded) return

    if (!isRemoteCamera || !remoteIsPhoneConnected || !remoteLatestFrame) {
      return
    }

    const now = performance.now()
    if (now - lastInferenceTimeRef.current < INFERENCE_INTERVAL_MS) {
      return
    }

    const image = remoteImageRef.current
    if (!image || !image.complete || image.naturalWidth === 0) {
      return
    }

    // Prevent concurrent inference
    if (isInferringRef.current) return
    isInferringRef.current = true
    lastInferenceTimeRef.current = now

    // Phone sends pre-cropped frames in auto mode, so no calibration needed
    const columnImages = processImageFrame(image, null, columnCount)
    if (columnImages.length === 0) {
      isInferringRef.current = false
      return
    }

    // Use ML-based digit classification (async)
    classifier.classifyColumns(columnImages).then((results) => {
      isInferringRef.current = false
      if (!results || results.digits.length === 0) return

      // Extract digits and minimum confidence
      const { digits, confidences } = results
      const minConfidence = Math.min(...confidences)

      // Store column digits for AbacusMirror display
      setColumnDigits(digits)

      // Convert to number
      const value = digitsToNumber(digits)

      // Push to stability buffer
      stability.pushFrame(value, minConfidence)
    })
  }, [
    isRemoteCamera,
    remoteIsPhoneConnected,
    remoteLatestFrame,
    columnCount,
    stability,
    classifier,
  ])

  // Local camera detection loop (only when enabled)
  useEffect(() => {
    // Skip detection loop when feature is disabled or model not loaded
    if (!ENABLE_AUTO_DETECTION) return
    if (!classifier.isModelLoaded) return

    if (!visionConfig.enabled || !isLocalCamera || !videoStream || !visionConfig.calibration) {
      return
    }

    let running = true

    const loop = () => {
      if (!running) return

      // processLocalFrame is async but we don't await - it handles concurrency internally
      processLocalFrame()
      animationFrameRef.current = requestAnimationFrame(loop)
    }

    loop()

    return () => {
      running = false
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [
    visionConfig.enabled,
    isLocalCamera,
    videoStream,
    visionConfig.calibration,
    processLocalFrame,
    classifier.isModelLoaded,
  ])

  // Handle stable value changes (only when auto-detection is enabled)
  useEffect(() => {
    // Skip value updates when feature is disabled
    if (!ENABLE_AUTO_DETECTION) return

    if (stability.stableValue !== null && stability.stableValue !== detectedValue) {
      setDetectedValue(stability.stableValue)
      setConfidence(stability.currentConfidence)
      setDockedValue(stability.stableValue)
      onValueDetected?.(stability.stableValue)
    }
  }, [
    stability.stableValue,
    stability.currentConfidence,
    detectedValue,
    setDockedValue,
    onValueDetected,
  ])

  // Show a subtle hint to try mirror mode when detection has been stable
  // This is non-intrusive - user can ignore it, and it goes away once they've tried mirror
  useEffect(() => {
    if (!ENABLE_AUTO_DETECTION) return
    if (!classifier.isModelLoaded) return
    if (hintDismissedRef.current) return // Don't show again if dismissed
    if (showAbacusMirror) return // Already in mirror mode, no need to suggest it

    // Show hint when we have stable detection (3+ consecutive frames)
    const isStable = stability.consecutiveFrames >= 3
    setShowMirrorHint(isStable && columnDigits.length > 0)
  }, [stability.consecutiveFrames, classifier.isModelLoaded, showAbacusMirror, columnDigits.length])

  // Broadcast vision frames to observers (5fps to save bandwidth)
  const BROADCAST_INTERVAL_MS = 200
  useEffect(() => {
    if (!visionConfig.enabled) return

    let running = true

    const broadcastLoop = () => {
      if (!running) return

      const now = performance.now()
      if (now - lastBroadcastTimeRef.current >= BROADCAST_INTERVAL_MS) {
        lastBroadcastTimeRef.current = now

        // Capture from rectified canvas (local camera) or remote image
        let imageData: string | null = null

        if (isLocalCamera && rectifiedCanvasRef.current) {
          const canvas = rectifiedCanvasRef.current
          if (canvas.width > 0 && canvas.height > 0) {
            // Convert canvas to JPEG (quality 0.7 for bandwidth)
            imageData = canvas.toDataURL('image/jpeg', 0.7).replace('data:image/jpeg;base64,', '')
          }
        } else if (isRemoteCamera && remoteLatestFrame) {
          // Remote camera already sends base64 JPEG
          imageData = remoteLatestFrame.imageData
        }

        if (imageData) {
          emitVisionFrame({
            imageData,
            detectedValue,
            confidence,
          })
        }
      }

      requestAnimationFrame(broadcastLoop)
    }

    broadcastLoop()

    return () => {
      running = false
    }
  }, [
    visionConfig.enabled,
    isLocalCamera,
    isRemoteCamera,
    remoteLatestFrame,
    detectedValue,
    confidence,
    emitVisionFrame,
  ])

  const handleDisableVision = (e: React.MouseEvent) => {
    e.stopPropagation()
    setVisionEnabled(false)
    if (videoStream) {
      videoStream.getTracks().forEach((track) => track.stop())
    }
  }

  if (error) {
    return (
      <div
        data-component="docked-vision-feed"
        data-status="error"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 4,
          bg: 'red.900/30',
          borderRadius: 'lg',
          color: 'red.400',
          textAlign: 'center',
        })}
      >
        <span className={css({ fontSize: 'xl' })}>⚠️</span>
        <span className={css({ fontSize: 'sm' })}>{error}</span>
        <button
          type="button"
          onClick={handleDisableVision}
          className={css({
            mt: 2,
            px: 3,
            py: 1,
            bg: 'gray.700',
            color: 'white',
            borderRadius: 'md',
            fontSize: 'xs',
            border: 'none',
            cursor: 'pointer',
          })}
        >
          Disable Vision
        </button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div
        data-component="docked-vision-feed"
        data-status="loading"
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
          p: 4,
          bg: 'gray.800/50',
          borderRadius: 'lg',
          color: 'gray.400',
        })}
      >
        <span className={css({ fontSize: 'xl' })}>📷</span>
        <span className={css({ fontSize: 'sm' })}>
          {isRemoteCamera ? 'Connecting to phone...' : 'Starting camera...'}
        </span>
      </div>
    )
  }

  return (
    <div
      data-component="docked-vision-feed"
      data-status="active"
      data-source={isRemoteCamera ? 'remote' : 'local'}
      className={css({
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'lg',
        bg: 'black',
        width: '100%',
        height: '100%',
        minHeight: 0, // Allow flex shrinking
      })}
    >
      {/* Main content area - takes available space above status bar */}
      <div
        data-element="vision-content"
        className={css({
          flex: '1 1 auto',
          minHeight: 0, // Allow shrinking
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
        })}
      >
        {/* AbacusReact mirror mode - shows detected values */}
        {showAbacusMirror && columnDigits.length > 0 ? (
          <div
            data-element="abacus-mirror"
            className={css({
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              bg: 'gray.900',
              p: '8px',
            })}
          >
          {/* Main AbacusReact display - takes available space */}
          <div
            data-element="abacus-main"
            className={css({
              flex: '1 1 auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: 0,
              height: '100%',
            })}
          >
            <AbacusReact
              value={detectedValue ?? 0}
              columns={columnDigits.length}
              interactive={false}
              animated={true}
              showNumbers={true}
              scaleFactor={1.2}
            />
          </div>

          {/* Video preview - fixed width sidebar */}
          <div
            data-element="video-preview"
            className={css({
              flex: '0 0 auto',
              width: '60px',
              height: '80px',
              borderRadius: 'md',
              overflow: 'hidden',
              border: '2px solid rgba(255,255,255,0.6)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              bg: 'black',
            })}
          >
            {isLocalCamera && (
              <VisionCameraFeed
                videoStream={videoStream}
                calibration={visionConfig.calibration}
                showRectifiedView={true}
                videoRef={(el) => {
                  videoRef.current = el
                  setVideoElement(el)
                }}
                rectifiedCanvasRef={(el) => {
                  rectifiedCanvasRef.current = el
                }}
              />
            )}
            {isRemoteCamera && remoteLatestFrame && (
              <img
                ref={remoteImageRef}
                src={`data:image/jpeg;base64,${remoteLatestFrame.imageData}`}
                alt="Phone camera view"
                className={css({
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                })}
              />
            )}
          </div>
        </div>
      ) : (
        <>
          {/* Rectified video feed - local camera */}
          {isLocalCamera && (
            <VisionCameraFeed
              videoStream={videoStream}
              calibration={visionConfig.calibration}
              showRectifiedView={true}
              videoRef={(el) => {
                videoRef.current = el
                setVideoElement(el) // Update state so marker detection hook can react
              }}
              rectifiedCanvasRef={(el) => {
                rectifiedCanvasRef.current = el
              }}
            />
          )}

          {/* Remote camera feed */}
          {isRemoteCamera && remoteLatestFrame && (
            <img
              ref={remoteImageRef}
              src={`data:image/jpeg;base64,${remoteLatestFrame.imageData}`}
              alt="Phone camera view"
              className={css({
                width: '100%',
                height: 'auto',
                objectFit: 'contain',
              })}
            />
          )}

          {/* Waiting for remote frames */}
          {isRemoteCamera && !remoteLatestFrame && remoteIsPhoneConnected && (
            <div
              className={css({
                width: '100%',
                aspectRatio: '2/1',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'gray.400',
                fontSize: 'sm',
              })}
            >
              Waiting for frames...
            </div>
          )}
        </>
        )}
      </div>

      {/* Unified status bar - combines detection info, mode toggle, and close button */}
      {ENABLE_AUTO_DETECTION && (
        <div
          data-element="vision-status-bar"
          className={css({
            flex: '0 0 auto', // Don't grow, don't shrink
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            px: 2,
            py: 1.5,
            bg: 'rgba(0, 0, 0, 0.85)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          })}
        >
          {/* Left side: Status (detected value or loading message) */}
          <div className={css({ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 })}>
            {classifier.isLoading ? (
              <span className={css({ fontSize: 'xs', color: 'yellow.400' })}>Loading...</span>
            ) : !classifier.isModelLoaded ? (
              <span className={css({ fontSize: 'xs', color: 'gray.500' })}>No model</span>
            ) : (
              <>
                {/* Detected value */}
                <span
                  className={css({
                    fontSize: 'md',
                    fontWeight: 'bold',
                    color: 'white',
                    fontFamily: 'mono',
                  })}
                >
                  {detectedValue !== null ? detectedValue : '---'}
                </span>
                {/* Stability dots - show detection stability */}
                {stability.consecutiveFrames > 0 && (
                  <div
                    className={css({ display: 'flex', gap: '2px', alignItems: 'center' })}
                    title={`Stability: ${stability.consecutiveFrames}/3`}
                  >
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div
                        key={i}
                        className={css({
                          w: '5px',
                          h: '5px',
                          borderRadius: 'full',
                          bg: i < stability.consecutiveFrames ? 'green.400' : 'gray.600',
                        })}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Center: Mode toggle with text labels */}
          <div className={css({ display: 'flex', alignItems: 'center', gap: 1, position: 'relative' })}>
            {columnDigits.length > 0 && (
              <>
                <div
                  data-element="mode-toggle"
                  className={css({
                    display: 'flex',
                    bg: 'rgba(255, 255, 255, 0.1)',
                    borderRadius: 'md',
                    p: '2px',
                  })}
                >
                  <button
                    type="button"
                    data-action="show-video"
                    onClick={() => setShowAbacusMirror(false)}
                    title="Show camera feed"
                    className={css({
                      px: 2,
                      py: 0.5,
                      borderRadius: 'sm',
                      border: 'none',
                      fontSize: 'xs',
                      fontWeight: 'medium',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      bg: !showAbacusMirror ? 'blue.500' : 'transparent',
                      color: !showAbacusMirror ? 'white' : 'gray.400',
                      _hover: {
                        color: 'white',
                      },
                    })}
                  >
                    Video
                  </button>
                  <button
                    type="button"
                    data-action="show-mirror"
                    onClick={() => {
                      hintDismissedRef.current = true
                      setShowMirrorHint(false)
                      setShowAbacusMirror(true)
                    }}
                    title="Show digital abacus mirror"
                    className={css({
                      px: 2,
                      py: 0.5,
                      borderRadius: 'sm',
                      border: 'none',
                      fontSize: 'xs',
                      fontWeight: 'medium',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      bg: showAbacusMirror ? 'blue.500' : 'transparent',
                      color: showAbacusMirror ? 'white' : 'gray.400',
                      _hover: {
                        color: 'white',
                      },
                    })}
                  >
                    Mirror
                  </button>
                </div>

                {/* Subtle hint when detection is working well */}
                {showMirrorHint && !showAbacusMirror && (
                  <div
                    data-element="mirror-hint"
                    onClick={() => {
                      hintDismissedRef.current = true
                      setShowMirrorHint(false)
                      setShowAbacusMirror(true)
                    }}
                    className={css({
                      position: 'absolute',
                      top: '-20px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      px: 2,
                      py: 0.5,
                      bg: 'green.600',
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 'medium',
                      borderRadius: 'full',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      animation: 'pulse 2s ease-in-out infinite',
                      _hover: {
                        bg: 'green.500',
                      },
                    })}
                  >
                    ✨ Try Mirror
                  </div>
                )}
              </>
            )}
          </div>

          {/* Right side: Undock + Close buttons */}
          <div className={css({ display: 'flex', alignItems: 'center', gap: 1 })}>
            {onUndock && (
              <button
                type="button"
                data-action="undock-abacus"
                onClick={(e) => {
                  e.stopPropagation()
                  onUndock()
                }}
                title="Undock abacus"
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  w: '24px',
                  h: '24px',
                  bg: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: 'md',
                  color: 'gray.400',
                  fontSize: 'xs',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  _hover: {
                    bg: 'blue.600',
                    borderColor: 'blue.600',
                    color: 'white',
                  },
                })}
              >
                ↗
              </button>
            )}
            <button
              type="button"
              data-action="disable-vision"
              onClick={handleDisableVision}
              title="Turn off camera"
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                w: '24px',
                h: '24px',
                bg: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.3)',
                borderRadius: 'md',
                color: 'gray.400',
                fontSize: 'xs',
                cursor: 'pointer',
                transition: 'all 0.15s',
                _hover: {
                  bg: 'red.600',
                  borderColor: 'red.600',
                  color: 'white',
                },
              })}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
