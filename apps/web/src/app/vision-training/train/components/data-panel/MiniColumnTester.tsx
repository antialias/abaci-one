'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../../../styled-system/css'
import { useColumnClassifier } from '@/hooks/useColumnClassifier'

export interface MiniColumnTesterProps {
  /** URL of the image to test */
  imagePath: string
  /** Ground truth digit (for comparison) */
  groundTruthDigit: number
}

/**
 * Mini column classifier tester for the detail panel.
 * Runs inference on the selected training image and shows results with visual overlay.
 */
export function MiniColumnTester({ imagePath, groundTruthDigit }: MiniColumnTesterProps) {
  const [result, setResult] = useState<{
    digit: number
    heaven: number
    earth: number
    heavenConf: number
    earthConf: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [hasRun, setHasRun] = useState(false)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  const classifier = useColumnClassifier()

  // Reset state when image changes
  useEffect(() => {
    setResult(null)
    setError(null)
    setHasRun(false)
  }, [imagePath])

  // Create canvas for ImageData extraction
  useEffect(() => {
    if (!canvasRef.current) {
      canvasRef.current = document.createElement('canvas')
    }
  }, [])

  const runInference = useCallback(async () => {
    if (!imageRef.current || !canvasRef.current || isRunning) return
    if (!imageRef.current.complete) {
      setError('Image not loaded yet')
      return
    }

    setIsRunning(true)
    setError(null)

    try {
      // Ensure model is loaded
      if (!classifier.isModelLoaded) {
        await classifier.preload()
      }

      // Extract ImageData from image
      const canvas = canvasRef.current
      const img = imageRef.current
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight

      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

      // Run classification
      const classResult = await classifier.classifyColumn(imageData)

      if (!classResult) {
        throw new Error('Classification failed - model may not be available')
      }

      setResult({
        digit: classResult.digit,
        heaven: classResult.beadPosition.heaven,
        earth: classResult.beadPosition.earth,
        heavenConf: classResult.beadPosition.heavenConfidence,
        earthConf: classResult.beadPosition.earthConfidence,
      })
      setHasRun(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inference failed')
    } finally {
      setIsRunning(false)
    }
  }, [classifier, isRunning])

  const isCorrect = result ? result.digit === groundTruthDigit : null

  return (
    <div
      data-component="mini-column-tester"
      className={css({
        p: 3,
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
          mb: 3,
        })}
      >
        <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
          <span className={css({ fontSize: 'sm' })}>🧪</span>
          <span className={css({ fontSize: 'sm', fontWeight: 'medium', color: 'blue.300' })}>
            Model Tester
          </span>
        </div>
        <span className={css({ fontSize: 'xs', color: 'gray.500' })}>
          {classifier.isModelLoaded ? (
            <span className={css({ color: 'green.400' })}>Ready</span>
          ) : classifier.isLoading ? (
            <span className={css({ color: 'yellow.400' })}>Loading...</span>
          ) : classifier.isModelUnavailable ? (
            <span className={css({ color: 'red.400' })}>Unavailable</span>
          ) : (
            <span className={css({ color: 'gray.400' })}>Not loaded</span>
          )}
        </span>
      </div>

      {/* Visual preview with prediction overlay */}
      <div
        className={css({
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          bg: 'gray.800',
          borderRadius: 'md',
          overflow: 'hidden',
          mb: 3,
          p: 2,
        })}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imageRef}
          src={imagePath}
          alt="Column for inference"
          crossOrigin="anonymous"
          className={css({
            maxHeight: '200px',
            objectFit: 'contain',
          })}
        />

        {/* Prediction overlay badge */}
        {result && (
          <div
            className={css({
              position: 'absolute',
              top: 2,
              right: 2,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
            })}
          >
            {/* Predicted digit */}
            <div
              className={css({
                width: '48px',
                height: '48px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                bg: isCorrect ? 'green.600' : 'red.600',
                color: 'white',
                fontSize: '2xl',
                fontWeight: 'bold',
                fontFamily: 'mono',
                borderRadius: 'lg',
                border: '2px solid',
                borderColor: isCorrect ? 'green.400' : 'red.400',
                boxShadow: 'lg',
              })}
            >
              {result.digit}
            </div>
            {/* Status indicator */}
            <div
              className={css({
                px: 2,
                py: 0.5,
                bg: isCorrect ? 'green.900/80' : 'red.900/80',
                color: isCorrect ? 'green.300' : 'red.300',
                fontSize: 'xs',
                fontWeight: 'medium',
                borderRadius: 'sm',
              })}
            >
              {isCorrect ? '✓ Correct' : '✗ Wrong'}
            </div>
          </div>
        )}

        {/* Ground truth badge */}
        <div
          className={css({
            position: 'absolute',
            bottom: 2,
            left: 2,
            px: 2,
            py: 1,
            bg: 'black/70',
            color: 'gray.300',
            fontSize: 'xs',
            borderRadius: 'sm',
          })}
        >
          Expected:{' '}
          <span className={css({ fontWeight: 'bold', color: 'white' })}>{groundTruthDigit}</span>
        </div>
      </div>

      {/* Run button */}
      <button
        type="button"
        onClick={runInference}
        disabled={isRunning || classifier.isLoading || classifier.isModelUnavailable}
        className={css({
          w: '100%',
          py: 2,
          bg: hasRun ? 'gray.700' : 'blue.600',
          color: 'white',
          borderRadius: 'md',
          border: 'none',
          cursor: 'pointer',
          fontWeight: 'medium',
          fontSize: 'sm',
          _hover: { bg: hasRun ? 'gray.600' : 'blue.500' },
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

      {/* Bead positions detail */}
      {result && (
        <div
          className={css({
            mt: 3,
            p: 2,
            bg: 'gray.800',
            borderRadius: 'md',
          })}
        >
          <div className={css({ fontSize: 'xs', color: 'gray.400', mb: 2 })}>Bead Positions:</div>
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 2,
              fontSize: 'sm',
            })}
          >
            <div>
              <span className={css({ color: 'gray.500' })}>Heaven:</span>{' '}
              <span className={css({ fontFamily: 'mono', color: 'gray.200' })}>
                {result.heaven}
              </span>
              <span className={css({ color: 'gray.500', fontSize: 'xs', ml: 1 })}>
                ({(result.heavenConf * 100).toFixed(0)}%)
              </span>
            </div>
            <div>
              <span className={css({ color: 'gray.500' })}>Earth:</span>{' '}
              <span className={css({ fontFamily: 'mono', color: 'gray.200' })}>{result.earth}</span>
              <span className={css({ color: 'gray.500', fontSize: 'xs', ml: 1 })}>
                ({(result.earthConf * 100).toFixed(0)}%)
              </span>
            </div>
          </div>
          <div className={css({ mt: 2, fontSize: 'xs', color: 'gray.500', textAlign: 'center' })}>
            {result.heaven} × 5 + {result.earth} = {result.digit}
          </div>
        </div>
      )}

      {/* Full screen link */}
      <Link
        href={`/vision-training/column-classifier/test?image=${encodeURIComponent(imagePath)}`}
        className={css({
          display: 'block',
          mt: 3,
          py: 2,
          textAlign: 'center',
          bg: 'gray.800',
          color: 'blue.300',
          borderRadius: 'md',
          border: '1px solid',
          borderColor: 'gray.700',
          textDecoration: 'none',
          fontSize: 'sm',
          _hover: { bg: 'gray.700', borderColor: 'blue.600' },
        })}
      >
        Open Full Tester →
      </Link>
    </div>
  )
}
