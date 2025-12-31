'use client'

import { useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

interface CameraCaptureProps {
  onCapture: (file: File) => Promise<void>
  disabled?: boolean
  /** Auto-start camera when component mounts */
  autoStart?: boolean
}

/**
 * Camera capture component for taking photos of worksheets
 *
 * Works on both desktop (webcam) and mobile (rear camera)
 * Auto-selects rear camera on mobile for better quality
 */
export function CameraCapture({
  onCapture,
  disabled = false,
  autoStart = false,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isCapturing, setIsCapturing] = useState(false)

  const startCamera = async () => {
    try {
      setError(null)

      // Request camera with rear camera preference on mobile
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: 'environment' }, // Prefer rear camera
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setIsStreaming(true)
      }
    } catch (err) {
      console.error('Camera access error:', err)
      setError('Camera access denied. Please allow camera access and try again.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsStreaming(false)
  }

  // Auto-start camera on mount if requested
  useEffect(() => {
    if (autoStart && !disabled) {
      startCamera()
    }
    // Cleanup on unmount
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart, disabled])

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return

    setIsCapturing(true)
    try {
      const video = videoRef.current
      const canvas = canvasRef.current

      // Set canvas size to video size
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight

      // Draw current video frame to canvas
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Could not get canvas context')

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

      // Convert to blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b)
            else reject(new Error('Failed to create blob'))
          },
          'image/jpeg',
          0.9
        )
      })

      // Create File object
      const file = new File([blob], `worksheet-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      })

      // Call upload handler
      await onCapture(file)

      // Success - could add visual feedback here
    } catch (err) {
      console.error('Capture error:', err)
      setError('Failed to capture photo. Please try again.')
    } finally {
      setIsCapturing(false)
    }
  }

  return (
    <div
      data-component="camera-capture"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        width: '100%',
      })}
    >
      {/* Camera viewport */}
      <div
        className={css({
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          bg: 'gray.900',
          borderRadius: 'md',
          overflow: 'hidden',
        })}
      >
        <video
          ref={videoRef}
          className={css({
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: isStreaming ? 'block' : 'none',
          })}
          playsInline
          muted
        />

        {!isStreaming && (
          <div
            className={css({
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'gray.400',
              fontSize: 'lg',
            })}
          >
            Camera not started
          </div>
        )}

        {/* Hidden canvas for capturing */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>

      {/* Error message */}
      {error && (
        <div
          data-status="error"
          className={css({
            p: 3,
            bg: 'red.50',
            border: '1px solid',
            borderColor: 'red.200',
            borderRadius: 'md',
            color: 'red.700',
            fontSize: 'sm',
          })}
        >
          {error}
        </div>
      )}

      {/* Controls */}
      <div
        className={css({
          display: 'flex',
          gap: 2,
          justifyContent: 'center',
        })}
      >
        {!isStreaming ? (
          <button
            data-action="start-camera"
            onClick={startCamera}
            disabled={disabled}
            className={css({
              px: 6,
              py: 3,
              bg: 'blue.500',
              color: 'white',
              borderRadius: 'md',
              fontSize: 'md',
              fontWeight: 'medium',
              cursor: 'pointer',
              _hover: { bg: 'blue.600' },
              _disabled: {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            })}
          >
            Start Camera
          </button>
        ) : (
          <>
            <button
              data-action="capture-photo"
              onClick={capturePhoto}
              disabled={disabled || isCapturing}
              className={css({
                px: 8,
                py: 4,
                bg: 'green.500',
                color: 'white',
                borderRadius: 'full',
                fontSize: 'lg',
                fontWeight: 'bold',
                cursor: 'pointer',
                _hover: { bg: 'green.600' },
                _disabled: {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                },
              })}
            >
              {isCapturing ? 'Uploading...' : '📷 Capture'}
            </button>

            <button
              data-action="stop-camera"
              onClick={stopCamera}
              disabled={disabled}
              className={css({
                px: 4,
                py: 2,
                bg: 'gray.500',
                color: 'white',
                borderRadius: 'md',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                _hover: { bg: 'gray.600' },
                _disabled: {
                  opacity: 0.5,
                  cursor: 'not-allowed',
                },
              })}
            >
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  )
}
