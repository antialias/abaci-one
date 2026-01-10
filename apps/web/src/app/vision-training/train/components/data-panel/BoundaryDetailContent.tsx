'use client'

import { useEffect, useState } from 'react'
import { css } from '../../../../../../styled-system/css'
import type { BoundaryDataItem } from './types'
import { MiniBoundaryTester } from './MiniBoundaryTester'

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

export interface BoundaryDetailContentProps {
  /** The selected boundary frame */
  item: BoundaryDataItem
  /** Handler to delete the item */
  onDelete: () => void
  /** Whether delete is in progress */
  isDeleting: boolean
}

/**
 * Detail content for boundary detector frames.
 * Shows preview with corners, marker masking, pipeline preview, and metadata.
 */
export function BoundaryDetailContent({ item, onDelete, isDeleting }: BoundaryDetailContentProps) {
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

  // Fetch masked preview when item changes
  useEffect(() => {
    if (!showMaskedPreview) {
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
        const imageResponse = await fetch(item.imagePath)
        const imageBlob = await imageResponse.blob()
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            const base64Data = result.replace(/^data:image\/[a-z]+;base64,/, '')
            resolve(base64Data)
          }
          reader.onerror = reject
          reader.readAsDataURL(imageBlob)
        })

        const response = await fetch('/api/vision-training/preview-masked', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            corners: item.corners,
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
        console.error('[BoundaryDetailContent] Masking error:', error)
        setMaskingError(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setMaskingInProgress(false)
      }
    }

    fetchMaskedPreview()
  }, [item, showMaskedPreview])

  // Fetch pipeline preview when enabled
  useEffect(() => {
    if (!showPipelinePreview) {
      setPipelinePreview(null)
      setPipelineError(null)
      return
    }

    const fetchPipelinePreview = async () => {
      setPipelineLoading(true)
      setPipelineError(null)
      setPipelinePreview(null)

      try {
        const imageResponse = await fetch(item.imagePath)
        const imageBlob = await imageResponse.blob()
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            const base64Data = result.replace(/^data:image\/[a-z]+;base64,/, '')
            resolve(base64Data)
          }
          reader.onerror = reject
          reader.readAsDataURL(imageBlob)
        })

        const response = await fetch('/api/vision-training/preview-augmentation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageData: base64,
            corners: item.corners,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Failed to generate pipeline preview')
        }

        const result = await response.json()
        setPipelinePreview(result.pipeline)
      } catch (error) {
        console.error('[BoundaryDetailContent] Pipeline preview error:', error)
        setPipelineError(error instanceof Error ? error.message : 'Unknown error')
      } finally {
        setPipelineLoading(false)
      }
    }

    fetchPipelinePreview()
  }, [item, showPipelinePreview])

  return (
    <div
      data-component="boundary-detail-content"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        height: '100%',
        overflow: 'auto',
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
          src={item.imagePath}
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
            points={`${item.corners.topLeft.x * 100},${item.corners.topLeft.y * 100} ${item.corners.topRight.x * 100},${item.corners.topRight.y * 100} ${item.corners.bottomRight.x * 100},${item.corners.bottomRight.y * 100} ${item.corners.bottomLeft.x * 100},${item.corners.bottomLeft.y * 100}`}
            fill="rgba(147, 51, 234, 0.1)"
            stroke="rgba(147, 51, 234, 0.9)"
            strokeWidth="1"
          />
          <circle
            cx={item.corners.topLeft.x * 100}
            cy={item.corners.topLeft.y * 100}
            r="2"
            fill="#22c55e"
          />
          <circle
            cx={item.corners.topRight.x * 100}
            cy={item.corners.topRight.y * 100}
            r="2"
            fill="#22c55e"
          />
          <circle
            cx={item.corners.bottomRight.x * 100}
            cy={item.corners.bottomRight.y * 100}
            r="2"
            fill="#22c55e"
          />
          <circle
            cx={item.corners.bottomLeft.x * 100}
            cy={item.corners.bottomLeft.y * 100}
            r="2"
            fill="#22c55e"
          />
        </svg>
      </div>

      {/* Masked Preview Section */}
      <div
        className={css({
          p: 2,
          bg: 'gray.900',
          borderRadius: 'md',
          border: '1px solid',
          borderColor: 'orange.700/50',
        })}
      >
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
            <span className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'orange.300' })}>
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
                  <span className={css({ animation: 'spin 1s linear infinite' })}>⏳</span>
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
                      points={`${item.corners.topLeft.x * 100},${item.corners.topLeft.y * 100} ${item.corners.topRight.x * 100},${item.corners.topRight.y * 100} ${item.corners.bottomRight.x * 100},${item.corners.bottomRight.y * 100} ${item.corners.bottomLeft.x * 100},${item.corners.bottomLeft.y * 100}`}
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

            {maskedImageUrl && maskRegions.length > 0 && (
              <div className={css({ mt: 2, fontSize: 'xs', color: 'gray.400' })}>
                {maskRegions.length} marker region{maskRegions.length !== 1 ? 's' : ''} masked
              </div>
            )}

            <div className={css({ mt: 2, fontSize: 'xs', color: 'gray.500' })}>
              Training with masked images forces the model to learn frame edges, not markers.
            </div>
          </>
        )}
      </div>

      {/* Pipeline Preview Section */}
      <div
        className={css({
          p: 2,
          bg: 'gray.900',
          borderRadius: 'md',
          border: '1px solid',
          borderColor: 'blue.700/50',
        })}
      >
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
            <span className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'blue.300' })}>
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
                    <div className={css({ display: 'flex', alignItems: 'center', gap: 2, mb: 2 })}>
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
                        className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'gray.100' })}
                      >
                        {step.title}
                      </span>
                    </div>

                    <div className={css({ fontSize: 'xs', color: 'gray.400', mb: 2 })}>
                      {step.description}
                    </div>

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
                          className={css({ width: '100%', display: 'block' })}
                        />
                      </div>
                    )}

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
                              border: variant.label === 'Original' ? '2px solid' : '1px solid',
                              borderColor: variant.label === 'Original' ? 'green.500' : 'gray.600',
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

                    {step.error && (
                      <div className={css({ mt: 2, fontSize: 'xs', color: 'red.400' })}>
                        Error: {step.error}
                      </div>
                    )}
                  </div>
                ))}

                <div className={css({ fontSize: 'xs', color: 'gray.500' })}>
                  This shows the exact preprocessing pipeline used during training.
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

      {/* Model Tester */}
      <MiniBoundaryTester imagePath={item.imagePath} groundTruthCorners={item.corners} />

      {/* Metadata */}
      <div className={css({ fontSize: 'sm' })}>
        <div className={css({ color: 'gray.400', mb: 1 })}>Captured</div>
        <div className={css({ color: 'gray.200' })}>
          {item.capturedAt ? new Date(item.capturedAt).toLocaleString() : 'Unknown'}
        </div>
      </div>

      <div className={css({ fontSize: 'sm' })}>
        <div className={css({ color: 'gray.400', mb: 1 })}>Resolution</div>
        <div className={css({ color: 'gray.200' })}>
          {item.frameWidth} × {item.frameHeight}
        </div>
      </div>

      <div className={css({ fontSize: 'sm' })}>
        <div className={css({ color: 'gray.400', mb: 1 })}>Device</div>
        <div className={css({ color: 'gray.200', fontFamily: 'mono', fontSize: 'xs' })}>
          {item.deviceId}
        </div>
      </div>

      {/* Delete button */}
      <button
        type="button"
        onClick={onDelete}
        disabled={isDeleting}
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
        {isDeleting ? 'Deleting...' : '🗑️ Delete Frame'}
      </button>
    </div>
  )
}
