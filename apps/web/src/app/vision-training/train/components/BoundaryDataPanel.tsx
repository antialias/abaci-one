'use client'

import { useCallback, useEffect, useState } from 'react'
import { css } from '../../../../../styled-system/css'
import type { QuadCorners } from '@/types/vision'
import type { DataPanelProps } from '../../registry'
import { BoundaryDataCapture } from './BoundaryDataCapture'

interface BoundaryFrame {
  baseName: string
  deviceId: string
  imagePath: string
  capturedAt: string
  corners: QuadCorners
  frameWidth: number
  frameHeight: number
}

type ViewMode = 'browse' | 'capture'

// Pipeline preview types
interface PipelineStepVariant {
  image_base64: string
  label: string
  description: string
}
interface PipelineStep {
  step: number
  name: string
  title: string
  description: string
  image_base64?: string
  variants?: PipelineStepVariant[]
  error?: string
  note?: string
  original_size?: string
  target_size?: string
}
interface PipelinePreview {
  steps: PipelineStep[]
}

interface BoundaryDataPanelProps extends DataPanelProps {
  /** Show the header with title and frame count (default: true for modal, false for shell) */
  showHeader?: boolean
}

/**
 * Boundary Data Panel
 *
 * Standalone panel for managing boundary detector training data.
 * Can be used inside a modal or directly in the shell.
 *
 * Features:
 * - Browse captured frames with corner annotations
 * - Delete bad frames
 * - Capture new frames
 * - Preview marker masking
 * - Preview preprocessing pipeline
 */
export function BoundaryDataPanel({ onDataChanged, showHeader = false }: BoundaryDataPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [frames, setFrames] = useState<BoundaryFrame[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFrame, setSelectedFrame] = useState<BoundaryFrame | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Marker masking preview state
  const [maskedImageUrl, setMaskedImageUrl] = useState<string | null>(null)
  const [maskingInProgress, setMaskingInProgress] = useState(false)
  const [maskingError, setMaskingError] = useState<string | null>(null)
  const [maskRegions, setMaskRegions] = useState<
    Array<{ x1: number; y1: number; x2: number; y2: number }>
  >([])
  const [showMaskedPreview, setShowMaskedPreview] = useState(true)

  // Pipeline preview state
  const [pipelinePreview, setPipelinePreview] = useState<PipelinePreview | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(false)
  const [pipelineError, setPipelineError] = useState<string | null>(null)
  const [showPipelinePreview, setShowPipelinePreview] = useState(false)

  // Load frames on mount
  const loadFrames = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vision-training/boundary-samples?list=true')
      if (response.ok) {
        const data = await response.json()
        setFrames(data.frames || [])
      }
    } catch (error) {
      console.error('[BoundaryDataPanel] Failed to load frames:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadFrames()
  }, [loadFrames])

  // Fetch masked preview when frame is selected
  useEffect(() => {
    if (!selectedFrame || !showMaskedPreview) {
      setMaskedImageUrl(null)
      setMaskRegions([])
      setMaskingError(null)
      return
    }

    const fetchMaskedPreview = async () => {
      setMaskingInProgress(true)
      setMaskingError(null)
      setMaskedImageUrl(null)
      setMaskRegions([])

      try {
        // Fetch the original image and convert to base64
        const imageResponse = await fetch(selectedFrame.imagePath)
        const imageBlob = await imageResponse.blob()
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            // Remove the data URL prefix to get just the base64
            const base64Data = result.replace(/^data:image\/[a-z]+;base64,/, '')
            resolve(base64Data)
          }
          reader.onerror = reject
          reader.readAsDataURL(imageBlob)
        })

        // Call the preview-masked API
        const response = await fetch('/api/vision-training/preview-masked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            corners: selectedFrame.corners,
            method: 'noise',
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate masked preview')
        }

        const result = await response.json()
        setMaskedImageUrl(`data:image/png;base64,${result.maskedImageData}`)
        setMaskRegions(result.maskRegions || [])
      } catch (error) {
        console.error('[BoundaryDataPanel] Masking error:', error)
        setMaskingError(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setMaskingInProgress(false)
      }
    }

    fetchMaskedPreview()
  }, [selectedFrame, showMaskedPreview])

  // Fetch pipeline preview when frame is selected and preview is enabled
  useEffect(() => {
    if (!selectedFrame || !showPipelinePreview) {
      setPipelinePreview(null)
      setPipelineError(null)
      return
    }

    const fetchPipelinePreview = async () => {
      setPipelineLoading(true)
      setPipelineError(null)
      setPipelinePreview(null)

      try {
        // Fetch the original image and convert to base64
        const imageResponse = await fetch(selectedFrame.imagePath)
        const imageBlob = await imageResponse.blob()
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            // Remove the data URL prefix to get just the base64
            const base64Data = result.replace(/^data:image\/[a-z]+;base64,/, '')
            resolve(base64Data)
          }
          reader.onerror = reject
          reader.readAsDataURL(imageBlob)
        })

        // Call the preview-augmentation API (now shows full pipeline)
        const response = await fetch('/api/vision-training/preview-augmentation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            corners: selectedFrame.corners,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate pipeline preview')
        }

        const result = await response.json()
        setPipelinePreview(result.pipeline)
      } catch (error) {
        console.error('[BoundaryDataPanel] Pipeline preview error:', error)
        setPipelineError(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setPipelineLoading(false)
      }
    }

    fetchPipelinePreview()
  }, [selectedFrame, showPipelinePreview])

  // Delete a frame
  const handleDelete = useCallback(
    async (frame: BoundaryFrame) => {
      if (!confirm('Delete this frame? This cannot be undone.')) return

      setDeleting(frame.baseName)
      try {
        const response = await fetch(
          `/api/vision-training/boundary-samples?deviceId=${frame.deviceId}&baseName=${frame.baseName}`,
          { method: 'DELETE' }
        )

        if (response.ok) {
          setFrames((prev) => prev.filter((f) => f.baseName !== frame.baseName))
          if (selectedFrame?.baseName === frame.baseName) {
            setSelectedFrame(null)
          }
          onDataChanged?.()
        } else {
          alert('Failed to delete frame')
        }
      } catch (error) {
        console.error('[BoundaryDataPanel] Delete error:', error)
        alert('Failed to delete frame')
      } finally {
        setDeleting(null)
      }
    },
    [selectedFrame, onDataChanged]
  )

  // Handle capture completion
  const handleSamplesCollected = useCallback(() => {
    loadFrames()
    onDataChanged?.()
  }, [loadFrames, onDataChanged])

  return (
    <div
      data-component="boundary-data-panel"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        bg: 'gray.900',
      })}
    >
      {/* Optional header */}
      {showHeader && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            p: 4,
            borderBottom: '1px solid',
            borderColor: 'gray.800',
          })}
        >
          <span className={css({ fontSize: 'xl' })}>🎯</span>
          <div>
            <h2 className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'gray.100' })}>
              Boundary Training Data
            </h2>
            <div className={css({ fontSize: 'sm', color: 'gray.400' })}>
              {frames.length} {frames.length === 1 ? 'frame' : 'frames'} captured
            </div>
          </div>
        </div>
      )}

      {/* View mode tabs */}
      <div
        className={css({
          display: 'flex',
          borderBottom: '1px solid',
          borderColor: 'gray.800',
        })}
      >
        <button
          type="button"
          onClick={() => setViewMode('browse')}
          className={css({
            flex: 1,
            py: 3,
            px: 4,
            bg: viewMode === 'browse' ? 'gray.800' : 'transparent',
            border: 'none',
            borderBottom: '2px solid',
            borderColor: viewMode === 'browse' ? 'purple.500' : 'transparent',
            color: viewMode === 'browse' ? 'purple.300' : 'gray.400',
            cursor: 'pointer',
            fontWeight: 'medium',
            fontSize: 'sm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            _hover: { bg: 'gray.800', color: 'gray.200' },
          })}
        >
          <span>🖼️</span>
          <span>Browse Frames</span>
        </button>
        <button
          type="button"
          onClick={() => setViewMode('capture')}
          className={css({
            flex: 1,
            py: 3,
            px: 4,
            bg: viewMode === 'capture' ? 'gray.800' : 'transparent',
            border: 'none',
            borderBottom: '2px solid',
            borderColor: viewMode === 'capture' ? 'green.500' : 'transparent',
            color: viewMode === 'capture' ? 'green.300' : 'gray.400',
            cursor: 'pointer',
            fontWeight: 'medium',
            fontSize: 'sm',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            _hover: { bg: 'gray.800', color: 'gray.200' },
          })}
        >
          <span>📸</span>
          <span>Capture New</span>
        </button>
      </div>

      {/* Content */}
      <div className={css({ flex: 1, overflow: 'auto', p: 4 })}>
        {viewMode === 'capture' ? (
          <BoundaryDataCapture onSamplesCollected={handleSamplesCollected} />
        ) : loading ? (
          <div className={css({ textAlign: 'center', py: 8 })}>
            <div className={css({ fontSize: '2xl', animation: 'spin 1s linear infinite' })}>⏳</div>
            <div className={css({ color: 'gray.400', mt: 2 })}>Loading frames...</div>
          </div>
        ) : frames.length === 0 ? (
          <div className={css({ textAlign: 'center', py: 8 })}>
            <div className={css({ fontSize: '3xl', mb: 3 })}>📷</div>
            <div className={css({ color: 'gray.300', mb: 2 })}>No frames captured yet</div>
            <div className={css({ fontSize: 'sm', color: 'gray.500', mb: 4 })}>
              Switch to "Capture New" to start collecting training data
            </div>
            <button
              type="button"
              onClick={() => setViewMode('capture')}
              className={css({
                py: 2,
                px: 4,
                bg: 'green.600',
                color: 'white',
                borderRadius: 'lg',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'medium',
                _hover: { bg: 'green.500' },
              })}
            >
              Start Capturing
            </button>
          </div>
        ) : (
          <div className={css({ display: 'flex', gap: 4, height: '100%', minHeight: '400px' })}>
            {/* Frame grid */}
            <div
              className={css({
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: 2,
                alignContent: 'start',
                overflow: 'auto',
              })}
            >
              {frames.map((frame) => (
                <button
                  key={frame.baseName}
                  type="button"
                  onClick={() => setSelectedFrame(frame)}
                  className={css({
                    position: 'relative',
                    // Use actual image aspect ratio to ensure overlay aligns correctly
                    aspectRatio: `${frame.frameWidth}/${frame.frameHeight}`,
                    bg: 'gray.800',
                    border: '2px solid',
                    borderColor:
                      selectedFrame?.baseName === frame.baseName ? 'purple.500' : 'gray.700',
                    borderRadius: 'lg',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    _hover: { borderColor: 'purple.400' },
                  })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={frame.imagePath}
                    alt={`Frame ${frame.baseName}`}
                    className={css({
                      width: '100%',
                      height: '100%',
                      // Use 'fill' since container now matches image aspect ratio exactly
                      objectFit: 'fill',
                    })}
                  />
                  {/* Corner overlay */}
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className={css({
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    })}
                  >
                    <polygon
                      points={`${frame.corners.topLeft.x * 100},${frame.corners.topLeft.y * 100} ${frame.corners.topRight.x * 100},${frame.corners.topRight.y * 100} ${frame.corners.bottomRight.x * 100},${frame.corners.bottomRight.y * 100} ${frame.corners.bottomLeft.x * 100},${frame.corners.bottomLeft.y * 100}`}
                      fill="none"
                      stroke="rgba(147, 51, 234, 0.8)"
                      strokeWidth="2"
                    />
                    {/* Corner dots */}
                    <circle
                      cx={frame.corners.topLeft.x * 100}
                      cy={frame.corners.topLeft.y * 100}
                      r="3"
                      fill="#22c55e"
                    />
                    <circle
                      cx={frame.corners.topRight.x * 100}
                      cy={frame.corners.topRight.y * 100}
                      r="3"
                      fill="#22c55e"
                    />
                    <circle
                      cx={frame.corners.bottomRight.x * 100}
                      cy={frame.corners.bottomRight.y * 100}
                      r="3"
                      fill="#22c55e"
                    />
                    <circle
                      cx={frame.corners.bottomLeft.x * 100}
                      cy={frame.corners.bottomLeft.y * 100}
                      r="3"
                      fill="#22c55e"
                    />
                  </svg>
                </button>
              ))}
            </div>

            {/* Selected frame details */}
            {selectedFrame && (
              <div
                className={css({
                  width: '300px',
                  flexShrink: 0,
                  bg: 'gray.800',
                  borderRadius: 'lg',
                  p: 4,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                })}
              >
                {/* Preview with corners */}
                <div
                  className={css({
                    position: 'relative',
                    borderRadius: 'md',
                    overflow: 'hidden',
                  })}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={selectedFrame.imagePath}
                    alt="Selected frame"
                    className={css({ width: '100%', display: 'block' })}
                  />
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className={css({
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      pointerEvents: 'none',
                    })}
                  >
                    <polygon
                      points={`${selectedFrame.corners.topLeft.x * 100},${selectedFrame.corners.topLeft.y * 100} ${selectedFrame.corners.topRight.x * 100},${selectedFrame.corners.topRight.y * 100} ${selectedFrame.corners.bottomRight.x * 100},${selectedFrame.corners.bottomRight.y * 100} ${selectedFrame.corners.bottomLeft.x * 100},${selectedFrame.corners.bottomLeft.y * 100}`}
                      fill="rgba(147, 51, 234, 0.1)"
                      stroke="rgba(147, 51, 234, 0.9)"
                      strokeWidth="1"
                    />
                    <circle
                      cx={selectedFrame.corners.topLeft.x * 100}
                      cy={selectedFrame.corners.topLeft.y * 100}
                      r="2"
                      fill="#22c55e"
                    />
                    <circle
                      cx={selectedFrame.corners.topRight.x * 100}
                      cy={selectedFrame.corners.topRight.y * 100}
                      r="2"
                      fill="#22c55e"
                    />
                    <circle
                      cx={selectedFrame.corners.bottomRight.x * 100}
                      cy={selectedFrame.corners.bottomRight.y * 100}
                      r="2"
                      fill="#22c55e"
                    />
                    <circle
                      cx={selectedFrame.corners.bottomLeft.x * 100}
                      cy={selectedFrame.corners.bottomLeft.y * 100}
                      r="2"
                      fill="#22c55e"
                    />
                  </svg>
                </div>

                {/* Masked Preview Section */}
                <div
                  className={css({
                    mt: 3,
                    p: 2,
                    bg: 'gray.900',
                    borderRadius: 'md',
                    border: '1px solid',
                    borderColor: 'orange.700/50',
                  })}
                >
                  {/* Header with toggle */}
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: showMaskedPreview ? 2 : 0,
                    })}
                  >
                    <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
                      <span className={css({ fontSize: 'sm' })}>🎭</span>
                      <span
                        className={css({
                          fontSize: 'sm',
                          fontWeight: 'medium',
                          color: 'orange.300',
                        })}
                      >
                        Marker Masking Preview
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowMaskedPreview(!showMaskedPreview)}
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.400',
                        bg: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: { color: 'gray.200' },
                      })}
                    >
                      {showMaskedPreview ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {showMaskedPreview && (
                    <>
                      {/* Masked image preview */}
                      <div
                        className={css({
                          position: 'relative',
                          borderRadius: 'md',
                          overflow: 'hidden',
                          bg: 'gray.800',
                          minHeight: '100px',
                        })}
                      >
                        {maskingInProgress ? (
                          <div
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '100px',
                              color: 'gray.400',
                            })}
                          >
                            <span className={css({ animation: 'spin 1s linear infinite' })}>
                              ⏳
                            </span>
                            <span className={css({ ml: 2, fontSize: 'sm' })}>
                              Generating masked preview...
                            </span>
                          </div>
                        ) : maskingError ? (
                          <div
                            className={css({
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '100px',
                              color: 'red.400',
                              fontSize: 'sm',
                              textAlign: 'center',
                              p: 2,
                            })}
                          >
                            <span>❌ {maskingError}</span>
                          </div>
                        ) : maskedImageUrl ? (
                          <>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={maskedImageUrl}
                              alt="Marker-masked preview"
                              className={css({ width: '100%', display: 'block' })}
                            />
                            {/* Show corner overlay on masked image too */}
                            <svg
                              viewBox="0 0 100 100"
                              preserveAspectRatio="none"
                              className={css({
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                pointerEvents: 'none',
                              })}
                            >
                              <polygon
                                points={`${selectedFrame.corners.topLeft.x * 100},${selectedFrame.corners.topLeft.y * 100} ${selectedFrame.corners.topRight.x * 100},${selectedFrame.corners.topRight.y * 100} ${selectedFrame.corners.bottomRight.x * 100},${selectedFrame.corners.bottomRight.y * 100} ${selectedFrame.corners.bottomLeft.x * 100},${selectedFrame.corners.bottomLeft.y * 100}`}
                                fill="rgba(249, 115, 22, 0.1)"
                                stroke="rgba(249, 115, 22, 0.9)"
                                strokeWidth="1"
                              />
                            </svg>
                          </>
                        ) : (
                          <div
                            className={css({
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '100px',
                              color: 'gray.500',
                              fontSize: 'sm',
                            })}
                          >
                            No masked preview
                          </div>
                        )}
                      </div>

                      {/* Masking stats */}
                      {maskedImageUrl && maskRegions.length > 0 && (
                        <div
                          className={css({
                            mt: 2,
                            fontSize: 'xs',
                            color: 'gray.400',
                          })}
                        >
                          {maskRegions.length} marker region
                          {maskRegions.length !== 1 ? 's' : ''} masked
                        </div>
                      )}

                      {/* Info text */}
                      <div
                        className={css({
                          mt: 2,
                          fontSize: 'xs',
                          color: 'gray.500',
                        })}
                      >
                        Training with masked images forces the model to learn frame edges, not
                        markers.
                      </div>
                    </>
                  )}
                </div>

                {/* Pipeline Preview Section */}
                <div
                  className={css({
                    mt: 3,
                    p: 2,
                    bg: 'gray.900',
                    borderRadius: 'md',
                    border: '1px solid',
                    borderColor: 'blue.700/50',
                  })}
                >
                  {/* Header with toggle */}
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      mb: showPipelinePreview ? 2 : 0,
                    })}
                  >
                    <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
                      <span className={css({ fontSize: 'sm' })}>🔬</span>
                      <span
                        className={css({
                          fontSize: 'sm',
                          fontWeight: 'medium',
                          color: 'blue.300',
                        })}
                      >
                        Preprocessing Pipeline
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowPipelinePreview(!showPipelinePreview)}
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.400',
                        bg: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: { color: 'gray.200' },
                      })}
                    >
                      {showPipelinePreview ? 'Hide' : 'Show'}
                    </button>
                  </div>

                  {showPipelinePreview && (
                    <>
                      {pipelineLoading ? (
                        <div
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100px',
                            color: 'gray.400',
                          })}
                        >
                          <span className={css({ animation: 'spin 1s linear infinite' })}>⏳</span>
                          <span className={css({ ml: 2, fontSize: 'sm' })}>
                            Generating pipeline preview...
                          </span>
                        </div>
                      ) : pipelineError ? (
                        <div
                          className={css({
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '100px',
                            color: 'red.400',
                            fontSize: 'sm',
                            textAlign: 'center',
                            p: 2,
                          })}
                        >
                          <span>❌ {pipelineError}</span>
                        </div>
                      ) : pipelinePreview ? (
                        <div className={css({ display: 'flex', flexDirection: 'column', gap: 3 })}>
                          {pipelinePreview.steps.map((step) => (
                            <div
                              key={step.step}
                              className={css({
                                p: 2,
                                bg: 'gray.800',
                                borderRadius: 'md',
                                border: '1px solid',
                                borderColor: 'gray.700',
                              })}
                            >
                              {/* Step header */}
                              <div
                                className={css({
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 2,
                                  mb: 2,
                                })}
                              >
                                <span
                                  className={css({
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '20px',
                                    height: '20px',
                                    bg: 'blue.600',
                                    color: 'white',
                                    borderRadius: 'full',
                                    fontSize: 'xs',
                                    fontWeight: 'bold',
                                  })}
                                >
                                  {step.step}
                                </span>
                                <span
                                  className={css({
                                    fontSize: 'sm',
                                    fontWeight: 'medium',
                                    color: 'gray.100',
                                  })}
                                >
                                  {step.title}
                                </span>
                              </div>

                              {/* Step description */}
                              <div
                                className={css({
                                  fontSize: 'xs',
                                  color: 'gray.400',
                                  mb: 2,
                                })}
                              >
                                {step.description}
                              </div>

                              {/* Single image step */}
                              {step.image_base64 && (
                                <div
                                  className={css({
                                    borderRadius: 'sm',
                                    overflow: 'hidden',
                                    border: '1px solid',
                                    borderColor: 'gray.600',
                                  })}
                                >
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={`data:image/jpeg;base64,${step.image_base64}`}
                                    alt={step.title}
                                    className={css({
                                      width: '100%',
                                      display: 'block',
                                    })}
                                  />
                                </div>
                              )}

                              {/* Augmentation variants */}
                              {step.variants && (
                                <div
                                  className={css({
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(3, 1fr)',
                                    gap: 1,
                                  })}
                                >
                                  {step.variants.map((variant, i) => (
                                    <div
                                      key={i}
                                      className={css({
                                        position: 'relative',
                                        borderRadius: 'sm',
                                        overflow: 'hidden',
                                        border:
                                          variant.label === 'Original' ? '2px solid' : '1px solid',
                                        borderColor:
                                          variant.label === 'Original' ? 'green.500' : 'gray.600',
                                      })}
                                    >
                                      {/* eslint-disable-next-line @next/next/no-img-element */}
                                      <img
                                        src={`data:image/jpeg;base64,${variant.image_base64}`}
                                        alt={variant.label}
                                        className={css({
                                          width: '100%',
                                          aspectRatio: '1',
                                          objectFit: 'cover',
                                        })}
                                      />
                                      <div
                                        className={css({
                                          position: 'absolute',
                                          bottom: 0,
                                          left: 0,
                                          right: 0,
                                          bg: 'black/80',
                                          fontSize: '8px',
                                          color: 'gray.200',
                                          textAlign: 'center',
                                          py: '2px',
                                          px: 1,
                                        })}
                                        title={variant.description}
                                      >
                                        {variant.label}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Notes */}
                              {step.note && (
                                <div
                                  className={css({
                                    mt: 2,
                                    fontSize: 'xs',
                                    color: 'gray.500',
                                    fontStyle: 'italic',
                                  })}
                                >
                                  Note: {step.note}
                                </div>
                              )}

                              {/* Error */}
                              {step.error && (
                                <div
                                  className={css({
                                    mt: 2,
                                    fontSize: 'xs',
                                    color: 'red.400',
                                  })}
                                >
                                  Error: {step.error}
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Info text */}
                          <div className={css({ fontSize: 'xs', color: 'gray.500' })}>
                            This shows the exact preprocessing pipeline used during training. Each
                            image goes through these steps in order.
                          </div>
                        </div>
                      ) : (
                        <div
                          className={css({
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            height: '60px',
                            color: 'gray.500',
                            fontSize: 'sm',
                          })}
                        >
                          Click "Show" to load pipeline preview
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Metadata */}
                <div className={css({ fontSize: 'sm' })}>
                  <div className={css({ color: 'gray.400', mb: 1 })}>Captured</div>
                  <div className={css({ color: 'gray.200' })}>
                    {selectedFrame.capturedAt
                      ? new Date(selectedFrame.capturedAt).toLocaleString()
                      : 'Unknown'}
                  </div>
                </div>

                <div className={css({ fontSize: 'sm' })}>
                  <div className={css({ color: 'gray.400', mb: 1 })}>Resolution</div>
                  <div className={css({ color: 'gray.200' })}>
                    {selectedFrame.frameWidth} × {selectedFrame.frameHeight}
                  </div>
                </div>

                <div className={css({ fontSize: 'sm' })}>
                  <div className={css({ color: 'gray.400', mb: 1 })}>Device</div>
                  <div className={css({ color: 'gray.200', fontFamily: 'mono', fontSize: 'xs' })}>
                    {selectedFrame.deviceId}
                  </div>
                </div>

                {/* Delete button */}
                <button
                  type="button"
                  onClick={() => handleDelete(selectedFrame)}
                  disabled={deleting === selectedFrame.baseName}
                  className={css({
                    mt: 'auto',
                    py: 2,
                    bg: 'red.600/20',
                    color: 'red.400',
                    border: '1px solid',
                    borderColor: 'red.600/50',
                    borderRadius: 'md',
                    cursor: 'pointer',
                    fontWeight: 'medium',
                    _hover: { bg: 'red.600/30', borderColor: 'red.500' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  {deleting === selectedFrame.baseName ? 'Deleting...' : '🗑️ Delete Frame'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
