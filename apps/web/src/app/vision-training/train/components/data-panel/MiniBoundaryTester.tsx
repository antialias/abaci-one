'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../../../styled-system/css'
import { useBoundaryDetector } from '@/hooks/useBoundaryDetector'
import type { QuadCorners } from '@/types/vision'

export interface MiniBoundaryTesterProps {
  /** URL of the image to test */
  imagePath: string
  /** Ground truth corners from the annotation */
  groundTruthCorners: QuadCorners
}

/**
 * Mini boundary detector tester for the detail panel.
 * Runs inference on the selected training image and shows results with visual overlay.
 */
export function MiniBoundaryTester({ imagePath, groundTruthCorners }: MiniBoundaryTesterProps) {
  const [result, setResult] = useState<{
    corners: QuadCorners
    confidence: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)

  const detector = useBoundaryDetector({ enabled: true })

  // Reset state when image changes
  useEffect(() => {
    setResult(null)
    setError(null)
    setHasRun(false)
  }, [imagePath])

  const runInference = useCallback(async () => {
    if (!imageRef.current || isRunning) return

    setIsRunning(true)
    setError(null)

    try {
      // Ensure model is loaded
      if (!detector.isReady) {
        await detector.preload()
      }

      const detectionResult = await detector.detectFromImage(imageRef.current)

      if (!detectionResult) {
        throw new Error('Detection failed - model may not be available')
      }

      setResult({
        corners: detectionResult.corners,
        confidence: detectionResult.confidence,
      })
      setHasRun(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inference failed')
    } finally {
      setIsRunning(false)
    }
  }, [detector, isRunning])

  // Calculate corner error (average distance between predicted and ground truth)
  const calculateError = useCallback((): number | null => {
    if (!result) return null

    const corners = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const
    let totalError = 0

    for (const corner of corners) {
      const dx = result.corners[corner].x - groundTruthCorners[corner].x
      const dy = result.corners[corner].y - groundTruthCorners[corner].y
      totalError += Math.sqrt(dx * dx + dy * dy)
    }

    return totalError / 4
  }, [result, groundTruthCorners])

  const avgError = calculateError()

  // Get confidence color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'green.400'
    if (conf >= 0.5) return 'yellow.400'
    return 'red.400'
  }

  // Get error color (in normalized units, ~0.02 is very good, ~0.1 is bad)
  const getErrorColor = (err: number) => {
    if (err <= 0.02) return 'green.400'
    if (err <= 0.05) return 'yellow.400'
    return 'red.400'
  }

  return (
    <div
      data-component="mini-boundary-tester"
      className={css({
        p: 3,
        bg: 'gray.900',
        borderRadius: 'md',
        border: '1px solid',
        borderColor: 'purple.700/50',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mb: 3,
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <span className={css({ fontSize: 'sm' })}>🧪</span>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'medium',
              color: 'purple.300',
            })}
          >
            Model Tester
          </span>
        </div>
        <span className={css({ fontSize: 'xs', color: 'gray.500' })}>
          {detector.isReady ? (
            <span className={css({ color: 'green.400' })}>Ready</span>
          ) : detector.isLoading ? (
            <span className={css({ color: 'yellow.400' })}>Loading...</span>
          ) : detector.isUnavailable ? (
            <span className={css({ color: 'red.400' })}>Unavailable</span>
          ) : (
            <span className={css({ color: 'gray.400' })}>Not loaded</span>
          )}
        </span>
      </div>

      {/* Visual preview with corner overlay */}
      <div
        className={css({
          position: 'relative',
          width: '100%',
          aspectRatio: '4/3',
          bg: 'gray.800',
          borderRadius: 'md',
          overflow: 'hidden',
          mb: 3,
        })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={imagePath}
          alt="Frame for inference"
          crossOrigin="anonymous"
          className={css({
            width: '100%',
            height: '100%',
            objectFit: 'contain',
          })}
        />

        {/* Corner overlay SVG */}
        {result && (
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
            {/* Ground truth quadrilateral (green, dashed) */}
            <polygon
              points={`${groundTruthCorners.topLeft.x * 100},${groundTruthCorners.topLeft.y * 100} ${groundTruthCorners.topRight.x * 100},${groundTruthCorners.topRight.y * 100} ${groundTruthCorners.bottomRight.x * 100},${groundTruthCorners.bottomRight.y * 100} ${groundTruthCorners.bottomLeft.x * 100},${groundTruthCorners.bottomLeft.y * 100}`}
              fill="none"
              stroke="rgba(34, 197, 94, 0.8)"
              strokeWidth="0.5"
              strokeDasharray="2,1"
            />

            {/* Predicted quadrilateral (purple, solid) */}
            <polygon
              points={`${result.corners.topLeft.x * 100},${result.corners.topLeft.y * 100} ${result.corners.topRight.x * 100},${result.corners.topRight.y * 100} ${result.corners.bottomRight.x * 100},${result.corners.bottomRight.y * 100} ${result.corners.bottomLeft.x * 100},${result.corners.bottomLeft.y * 100}`}
              fill="rgba(147, 51, 234, 0.15)"
              stroke="rgba(147, 51, 234, 0.9)"
              strokeWidth="0.5"
            />

            {/* Ground truth corner markers (green squares) */}
            {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner) => (
              <rect
                key={`gt-${corner}`}
                x={groundTruthCorners[corner].x * 100 - 1}
                y={groundTruthCorners[corner].y * 100 - 1}
                width="2"
                height="2"
                fill="#22c55e"
                stroke="white"
                strokeWidth="0.3"
              />
            ))}

            {/* Predicted corner markers (purple circles) */}
            {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner) => (
              <circle
                key={`pred-${corner}`}
                cx={result.corners[corner].x * 100}
                cy={result.corners[corner].y * 100}
                r="1.5"
                fill="#a855f7"
                stroke="white"
                strokeWidth="0.3"
              />
            ))}

            {/* Error lines connecting ground truth to predicted */}
            {(['topLeft', 'topRight', 'bottomLeft', 'bottomRight'] as const).map((corner) => (
              <line
                key={`error-${corner}`}
                x1={groundTruthCorners[corner].x * 100}
                y1={groundTruthCorners[corner].y * 100}
                x2={result.corners[corner].x * 100}
                y2={result.corners[corner].y * 100}
                stroke="rgba(239, 68, 68, 0.8)"
                strokeWidth="0.3"
              />
            ))}
          </svg>
        )}

        {/* Legend overlay */}
        {result && (
          <div
            className={css({
              position: 'absolute',
              bottom: 1,
              left: 1,
              display: 'flex',
              gap: 2,
              px: 1.5,
              py: 0.5,
              bg: 'black/70',
              borderRadius: 'sm',
              fontSize: '10px',
            })}
          >
            <span className={css({ color: 'green.400' })}>■ Ground Truth</span>
            <span className={css({ color: 'purple.400' })}>● Predicted</span>
          </div>
        )}
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={runInference}
        disabled={isRunning || detector.isLoading || detector.isUnavailable}
        className={css({
          w: '100%',
          py: 2,
          bg: hasRun ? 'gray.700' : 'purple.600',
          color: 'white',
          borderRadius: 'md',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'medium',
          fontSize: 'sm',
          _hover: { bg: hasRun ? 'gray.600' : 'purple.500' },
          _disabled: { opacity: 0.5, cursor: 'not-allowed' },
        })}
      >
        {isRunning ? 'Running...' : hasRun ? 'Run Again' : 'Test Model'}
      </button>

      {/* Error display */}
      {error && (
        <div
          className={css({
            mt: 2,
            p: 2,
            bg: 'red.900/30',
            border: '1px solid',
            borderColor: 'red.700',
            borderRadius: 'md',
            color: 'red.300',
            fontSize: 'xs',
          })}
        >
          {error}
        </div>
      )}

      {/* Results summary */}
      {result && (
        <div
          className={css({
            mt: 3,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 2,
          })}
        >
          <div
            className={css({
              p: 2,
              bg: 'gray.800',
              borderRadius: 'md',
              textAlign: 'center',
            })}
          >
            <div className={css({ fontSize: 'xs', color: 'gray.400', mb: 1 })}>Confidence</div>
            <div
              className={css({
                fontSize: 'lg',
                fontWeight: 'bold',
                fontFamily: 'mono',
                color: getConfidenceColor(result.confidence),
              })}
            >
              {(result.confidence * 100).toFixed(1)}%
            </div>
          </div>
          <div
            className={css({
              p: 2,
              bg: 'gray.800',
              borderRadius: 'md',
              textAlign: 'center',
            })}
          >
            <div className={css({ fontSize: 'xs', color: 'gray.400', mb: 1 })}>Avg Error</div>
            <div
              className={css({
                fontSize: 'lg',
                fontWeight: 'bold',
                fontFamily: 'mono',
                color: avgError !== null ? getErrorColor(avgError) : 'gray.400',
              })}
            >
              {avgError !== null ? `${(avgError * 100).toFixed(1)}%` : '-'}
            </div>
          </div>
        </div>
      )}

      {/* Full screen link */}
      <Link
        href={`/vision-training/boundary-detector/test?image=${encodeURIComponent(imagePath)}`}
        className={css({
          display: 'block',
          mt: 3,
          py: 2,
          textAlign: 'center',
          bg: 'gray.800',
          color: 'purple.300',
          borderRadius: 'md',
          border: '1px solid',
          borderColor: 'gray.700',
          textDecoration: 'none',
          fontSize: 'sm',
          _hover: { bg: 'gray.700', borderColor: 'purple.600' },
        })}
      >
        Open Full Tester →
      </Link>
    </div>
  )
}
