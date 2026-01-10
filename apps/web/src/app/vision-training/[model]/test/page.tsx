'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { css } from '../../../../../styled-system/css'
import { ModelTester } from '../../train/components/ModelTester'
import { useColumnClassifier } from '@/hooks/useColumnClassifier'
import { useBoundaryDetector } from '@/hooks/useBoundaryDetector'
import { useModelType } from '../../hooks/useModelType'
import type { QuadCorners } from '@/types/vision'

interface SessionInfo {
  id: string
  modelType: 'column-classifier' | 'boundary-detector'
  displayName: string
  finalAccuracy: number
  finalPixelError?: number
  isActive: boolean
  trainedAt: number
}

/**
 * Model Testing Page
 *
 * Located at /vision-training/[model]/test
 * Model type is determined by the URL path.
 *
 * URL params:
 *   - session: ID of a specific session to test (optional)
 */
export default function TestModelPage() {
  const modelType = useModelType()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session')

  const [sessionInfo, setSessionInfo] = useState<SessionInfo | null>(null)
  const [sessionLoading, setSessionLoading] = useState(false)

  // Fetch session info if session ID provided
  useEffect(() => {
    if (!sessionId) {
      setSessionInfo(null)
      return
    }

    setSessionLoading(true)
    fetch(`/api/vision/sessions/${sessionId}`)
      .then((res) => {
        if (!res.ok) throw new Error('Session not found')
        return res.json()
      })
      .then((data) => {
        const session = data.session
        setSessionInfo({
          id: session.id,
          modelType: session.modelType,
          displayName: session.displayName,
          finalAccuracy: session.result?.final_accuracy ?? 0,
          finalPixelError: session.result?.final_pixel_error,
          isActive: session.isActive,
          trainedAt: session.trainedAt,
        })
      })
      .catch((err) => {
        console.error('[TestModelPage] Failed to load session:', err)
        setSessionInfo(null)
      })
      .finally(() => {
        setSessionLoading(false)
      })
  }, [sessionId])

  return (
    <div
      data-component="test-model-page"
      className={css({
        bg: 'gray.900',
        color: 'gray.100',
        pt: 4,
      })}
      style={{ minHeight: 'calc(100vh - var(--nav-height))' }}
    >
      {/* Session Info Banner */}
      {sessionLoading && (
        <div
          className={css({
            py: 3,
            px: 4,
            bg: 'blue.900/30',
            borderBottom: '1px solid',
            borderColor: 'blue.800',
            textAlign: 'center',
            color: 'blue.300',
            fontSize: 'sm',
          })}
        >
          Loading session info...
        </div>
      )}
      {sessionInfo && (
        <div
          className={css({
            py: 3,
            px: 4,
            bg: sessionInfo.isActive ? 'green.900/30' : 'yellow.900/30',
            borderBottom: '1px solid',
            borderColor: sessionInfo.isActive ? 'green.800' : 'yellow.800',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            fontSize: 'sm',
          })}
        >
          <span className={css({ color: sessionInfo.isActive ? 'green.300' : 'yellow.300' })}>
            {sessionInfo.isActive ? 'Testing Active Model:' : 'Testing Session:'}
          </span>
          <span className={css({ fontWeight: 'medium', color: 'white' })}>
            {sessionInfo.displayName}
          </span>
          {sessionInfo.modelType === 'boundary-detector' &&
          sessionInfo.finalPixelError !== undefined ? (
            <span className={css({ color: 'gray.400' })}>
              ({sessionInfo.finalPixelError.toFixed(1)}px error)
            </span>
          ) : (
            <span className={css({ color: 'gray.400' })}>
              ({(sessionInfo.finalAccuracy * 100).toFixed(1)}% accuracy)
            </span>
          )}
          {!sessionInfo.isActive && (
            <span className={css({ color: 'yellow.400', fontSize: 'xs' })}>
              Note: Non-active session testing requires model loader updates
            </span>
          )}
          <Link
            href={`/vision-training/${modelType}/sessions`}
            className={css({
              ml: 'auto',
              color: 'gray.400',
              textDecoration: 'none',
              fontSize: 'xs',
              _hover: { color: 'gray.200' },
            })}
          >
            View All Sessions
          </Link>
        </div>
      )}

      {/* Main Content */}
      <main
        className={css({
          maxWidth: '800px',
          mx: 'auto',
          p: 6,
        })}
      >
        {/* Title */}
        <div className={css({ textAlign: 'center', mb: 6 })}>
          <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>Model Tester</h1>
          <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
            {modelType === 'column-classifier'
              ? 'Test the column classifier with live camera feed or uploaded images'
              : 'Test the boundary detector with uploaded frame images or live camera'}
          </p>
        </div>

        {/* Column Classifier Testing */}
        {modelType === 'column-classifier' && (
          <>
            {/* Image Upload Tester */}
            <ImageUploadTester />

            {/* Divider */}
            <div
              className={css({
                my: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              })}
            >
              <div className={css({ flex: 1, height: '1px', bg: 'gray.700' })} />
              <span className={css({ color: 'gray.500', fontSize: 'sm' })}>or use camera</span>
              <div className={css({ flex: 1, height: '1px', bg: 'gray.700' })} />
            </div>

            {/* Model Tester */}
            <ModelTester columnCount={4} />

            {/* Quick info */}
            <div
              className={css({
                mt: 6,
                p: 4,
                bg: 'gray.800/50',
                borderRadius: 'lg',
                fontSize: 'sm',
                color: 'gray.400',
              })}
            >
              <h3 className={css({ fontWeight: 'medium', color: 'gray.300', mb: 2 })}>
                How to use:
              </h3>
              <ol className={css({ listStyle: 'decimal', pl: 4, '& li': { mb: 1 } })}>
                <li>Upload a training image PNG to test inference directly</li>
                <li>Or point your camera at the abacus with ArUco markers visible</li>
                <li>Wait for markers to be detected (green indicator)</li>
                <li>Click "Start Testing" to run continuous inference</li>
              </ol>
              <p className={css({ mt: 3, fontSize: 'xs', color: 'gray.500' })}>
                Model location: <code>/public/models/abacus-column-classifier/</code>
              </p>
            </div>
          </>
        )}

        {/* Boundary Detector Testing */}
        {modelType === 'boundary-detector' && (
          <>
            {/* Real-time Camera Tester */}
            <BoundaryCameraTester />

            {/* Divider */}
            <div
              className={css({
                my: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              })}
            >
              <div className={css({ flex: 1, height: '1px', bg: 'gray.700' })} />
              <span className={css({ color: 'gray.500', fontSize: 'sm' })}>or upload image</span>
              <div className={css({ flex: 1, height: '1px', bg: 'gray.700' })} />
            </div>

            {/* Image Upload Tester */}
            <BoundaryImageTester />

            {/* Quick info */}
            <div
              className={css({
                mt: 6,
                p: 4,
                bg: 'gray.800/50',
                borderRadius: 'lg',
                fontSize: 'sm',
                color: 'gray.400',
              })}
            >
              <h3 className={css({ fontWeight: 'medium', color: 'gray.300', mb: 2 })}>
                How to use:
              </h3>
              <ol className={css({ listStyle: 'decimal', pl: 4, '& li': { mb: 1 } })}>
                <li>Point camera at the abacus (no markers needed)</li>
                <li>Click "Start Testing" to run continuous inference</li>
                <li>View detected corners overlaid in real-time</li>
                <li>Or upload a frame image for single inference</li>
              </ol>
              <p className={css({ mt: 3, fontSize: 'xs', color: 'gray.500' })}>
                Model location: <code>/public/models/abacus-boundary-detector/</code>
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

/**
 * Component for uploading and testing individual training images
 */
function ImageUploadTester() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageData, setImageData] = useState<ImageData | null>(null)
  const [result, setResult] = useState<{
    digit: number
    heaven: number
    earth: number
    heavenConf: number
    earthConf: number
    earthProbs: number[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [expectedDigit, setExpectedDigit] = useState<number | null>(null)

  const classifier = useColumnClassifier()

  // Auto-load model on mount
  useEffect(() => {
    classifier.preload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setResult(null)
    setIsLoading(true)

    // Try to extract expected digit from filename (e.g., "5/image.png" or folder structure)
    const pathParts = file.webkitRelativePath?.split('/') || file.name.split('/')
    const digitMatch = pathParts.find((p) => /^[0-9]$/.test(p))
    if (digitMatch) {
      setExpectedDigit(parseInt(digitMatch, 10))
    } else {
      setExpectedDigit(null)
    }

    try {
      // Read file as data URL for display
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setUploadedImage(dataUrl)

      // Load as image and convert to ImageData
      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })

      // Draw to canvas to get ImageData
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) throw new Error('Failed to get canvas context')

      ctx.drawImage(img, 0, 0)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      setImageData(imgData)

      console.log('[ImageUploadTester] Image loaded:', {
        width: imgData.width,
        height: imgData.height,
        filename: file.name,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const runInference = useCallback(async () => {
    if (!imageData) return

    setError(null)
    setIsLoading(true)

    try {
      console.log('[ImageUploadTester] Running inference...')
      const classResult = await classifier.classifyColumn(imageData)

      if (!classResult) {
        throw new Error('Model not available or classification failed')
      }

      console.log('[ImageUploadTester] Result:', classResult)

      // Get the raw earth probabilities from the classifier hook
      // (we need to access the internal state - for now just show what we have)
      setResult({
        digit: classResult.digit,
        heaven: classResult.beadPosition.heaven,
        earth: classResult.beadPosition.earth,
        heavenConf: classResult.beadPosition.heavenConfidence,
        earthConf: classResult.beadPosition.earthConfidence,
        earthProbs: [], // Will be shown in console
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inference failed')
    } finally {
      setIsLoading(false)
    }
  }, [imageData, classifier])

  const isCorrect = result && expectedDigit !== null ? result.digit === expectedDigit : null

  return (
    <div
      data-component="image-upload-tester"
      className={css({
        p: 4,
        bg: 'blue.900/20',
        border: '1px solid',
        borderColor: 'blue.700/50',
        borderRadius: 'lg',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        })}
      >
        <span>Upload Training Image</span>
        <span className={css({ fontSize: 'xs', color: 'gray.500', ml: 'auto' })}>
          {classifier.isModelLoaded ? (
            <span className={css({ color: 'green.400' })}>Model loaded</span>
          ) : classifier.isLoading ? (
            <span className={css({ color: 'yellow.400' })}>Loading model...</span>
          ) : (
            <span className={css({ color: 'gray.400' })}>Model not loaded</span>
          )}
        </span>
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleFileSelect}
        className={css({ display: 'none' })}
      />

      <div className={css({ display: 'flex', gap: 3, alignItems: 'flex-start' })}>
        {/* Upload area / Preview */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={css({
            width: '128px',
            height: '256px',
            bg: 'gray.800',
            border: '2px dashed',
            borderColor: uploadedImage ? 'blue.600' : 'gray.600',
            borderRadius: 'lg',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            flexShrink: 0,
            _hover: { borderColor: 'blue.500' },
          })}
        >
          {uploadedImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={uploadedImage}
              alt="Uploaded"
              className={css({
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              })}
            />
          ) : (
            <div className={css({ textAlign: 'center', color: 'gray.500', p: 2 })}>
              <div className={css({ fontSize: '2xl', mb: 1 })}>+</div>
              <div className={css({ fontSize: 'xs' })}>Click to upload PNG from training data</div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className={css({ flex: 1 })}>
          {uploadedImage && (
            <button
              type="button"
              onClick={runInference}
              disabled={isLoading || !classifier.isModelLoaded}
              className={css({
                w: '100%',
                py: 2,
                px: 4,
                bg: 'blue.600',
                color: 'white',
                borderRadius: 'md',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 'medium',
                mb: 3,
                _hover: { bg: 'blue.500' },
                _disabled: { opacity: 0.5, cursor: 'not-allowed' },
              })}
            >
              {isLoading ? 'Running...' : 'Run Inference'}
            </button>
          )}

          {error && (
            <div
              className={css({
                p: 2,
                bg: 'red.900/30',
                border: '1px solid',
                borderColor: 'red.700',
                borderRadius: 'md',
                color: 'red.300',
                fontSize: 'sm',
                mb: 3,
              })}
            >
              {error}
            </div>
          )}

          {result && (
            <div
              className={css({
                p: 3,
                bg: 'gray.800',
                borderRadius: 'md',
              })}
            >
              {/* Prediction vs Expected */}
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  mb: 3,
                })}
              >
                <div
                  className={css({
                    fontSize: '4xl',
                    fontWeight: 'bold',
                    fontFamily: 'mono',
                    color: isCorrect === false ? 'red.400' : 'white',
                  })}
                >
                  {result.digit}
                </div>
                {expectedDigit !== null && (
                  <>
                    <div className={css({ color: 'gray.500' })}>vs expected</div>
                    <div
                      className={css({
                        fontSize: '4xl',
                        fontWeight: 'bold',
                        fontFamily: 'mono',
                        color: 'gray.400',
                      })}
                    >
                      {expectedDigit}
                    </div>
                    <div
                      className={css({
                        fontSize: '2xl',
                        ml: 2,
                      })}
                    >
                      {isCorrect ? 'Correct' : 'Wrong'}
                    </div>
                  </>
                )}
              </div>

              {/* Bead positions */}
              <div className={css({ fontSize: 'sm', color: 'gray.300' })}>
                <div className={css({ mb: 1 })}>
                  <span className={css({ color: 'gray.500' })}>Heaven:</span>{' '}
                  <span className={css({ fontFamily: 'mono' })}>{result.heaven}</span>
                  <span className={css({ color: 'gray.500', ml: 2 })}>
                    ({(result.heavenConf * 100).toFixed(1)}%)
                  </span>
                </div>
                <div>
                  <span className={css({ color: 'gray.500' })}>Earth:</span>{' '}
                  <span className={css({ fontFamily: 'mono' })}>{result.earth}</span>
                  <span className={css({ color: 'gray.500', ml: 2 })}>
                    ({(result.earthConf * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>

              {/* Formula reminder */}
              <div className={css({ mt: 2, fontSize: 'xs', color: 'gray.500' })}>
                digit = heaven x 5 + earth = {result.heaven} x 5 + {result.earth} = {result.digit}
              </div>
            </div>
          )}

          {!uploadedImage && (
            <div className={css({ color: 'gray.500', fontSize: 'sm' })}>
              <p>Upload a training image (64x128 PNG) to test inference.</p>
              <p className={css({ mt: 2, fontSize: 'xs' })}>
                Training images are in:{' '}
                <code className={css({ color: 'gray.400' })}>
                  data/vision-training/collected/{'<digit>'}/
                </code>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Component for uploading and testing boundary detection on frame images
 */
function BoundaryImageTester() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null)
  const [result, setResult] = useState<{
    corners: QuadCorners
    confidence: number
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const detector = useBoundaryDetector({ enabled: true })

  // Auto-load model on mount
  useEffect(() => {
    detector.preload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Only run once on mount

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)
    setResult(null)
    setIsLoading(true)

    try {
      // Read file as data URL for display
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      setUploadedImage(dataUrl)

      // Load as image element
      const img = new Image()
      img.src = dataUrl
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
      })
      setImageElement(img)

      console.log('[BoundaryImageTester] Image loaded:', {
        width: img.naturalWidth,
        height: img.naturalHeight,
        filename: file.name,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load image')
    } finally {
      setIsLoading(false)
    }
  }, [])

  const runInference = useCallback(async () => {
    if (!imageElement) return

    setError(null)
    setIsLoading(true)

    try {
      console.log('[BoundaryImageTester] Running inference...')
      const detectionResult = await detector.detectFromImage(imageElement)

      if (!detectionResult) {
        throw new Error('Model not available or detection failed')
      }

      console.log('[BoundaryImageTester] Result:', detectionResult)

      setResult({
        corners: detectionResult.corners,
        confidence: detectionResult.confidence,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inference failed')
    } finally {
      setIsLoading(false)
    }
  }, [imageElement, detector])

  // Get confidence color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'green.400'
    if (conf >= 0.5) return 'yellow.400'
    return 'red.400'
  }

  return (
    <div
      data-component="boundary-image-tester"
      className={css({
        p: 4,
        bg: 'purple.900/20',
        border: '1px solid',
        borderColor: 'purple.700/50',
        borderRadius: 'lg',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        })}
      >
        <span className={css({ fontWeight: 'medium', color: 'purple.300' })}>
          Upload Frame Image
        </span>
        <span className={css({ fontSize: 'xs', color: 'gray.500', ml: 'auto' })}>
          {detector.isReady ? (
            <span className={css({ color: 'green.400' })}>Model loaded</span>
          ) : detector.isLoading ? (
            <span className={css({ color: 'yellow.400' })}>Loading model...</span>
          ) : detector.isUnavailable ? (
            <span className={css({ color: 'red.400' })}>Model not available</span>
          ) : (
            <span className={css({ color: 'gray.400' })}>Model not loaded</span>
          )}
        </span>
      </div>

      {/* File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg"
        onChange={handleFileSelect}
        className={css({ display: 'none' })}
      />

      <div className={css({ display: 'flex', flexDirection: 'column', gap: 4 })}>
        {/* Upload area / Preview with corner overlay */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className={css({
            position: 'relative',
            width: '100%',
            aspectRatio: '4/3',
            bg: 'gray.800',
            border: '2px dashed',
            borderColor: uploadedImage ? 'purple.600' : 'gray.600',
            borderRadius: 'lg',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            overflow: 'hidden',
            _hover: { borderColor: 'purple.500' },
          })}
        >
          {uploadedImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={uploadedImage}
                alt="Uploaded"
                className={css({
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                })}
              />
              {/* Corner overlay */}
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
                  {/* Quadrilateral outline */}
                  <polygon
                    points={`${result.corners.topLeft.x * 100},${result.corners.topLeft.y * 100} ${result.corners.topRight.x * 100},${result.corners.topRight.y * 100} ${result.corners.bottomRight.x * 100},${result.corners.bottomRight.y * 100} ${result.corners.bottomLeft.x * 100},${result.corners.bottomLeft.y * 100}`}
                    fill="rgba(147, 51, 234, 0.15)"
                    stroke="rgba(147, 51, 234, 0.9)"
                    strokeWidth="0.5"
                  />
                  {/* Corner markers */}
                  <circle
                    cx={result.corners.topLeft.x * 100}
                    cy={result.corners.topLeft.y * 100}
                    r="1.5"
                    fill="#22c55e"
                    stroke="white"
                    strokeWidth="0.3"
                  />
                  <circle
                    cx={result.corners.topRight.x * 100}
                    cy={result.corners.topRight.y * 100}
                    r="1.5"
                    fill="#22c55e"
                    stroke="white"
                    strokeWidth="0.3"
                  />
                  <circle
                    cx={result.corners.bottomRight.x * 100}
                    cy={result.corners.bottomRight.y * 100}
                    r="1.5"
                    fill="#22c55e"
                    stroke="white"
                    strokeWidth="0.3"
                  />
                  <circle
                    cx={result.corners.bottomLeft.x * 100}
                    cy={result.corners.bottomLeft.y * 100}
                    r="1.5"
                    fill="#22c55e"
                    stroke="white"
                    strokeWidth="0.3"
                  />
                  {/* Corner labels */}
                  <text
                    x={result.corners.topLeft.x * 100 + 2}
                    y={result.corners.topLeft.y * 100 - 2}
                    fill="white"
                    fontSize="3"
                    fontWeight="bold"
                  >
                    TL
                  </text>
                  <text
                    x={result.corners.topRight.x * 100 - 5}
                    y={result.corners.topRight.y * 100 - 2}
                    fill="white"
                    fontSize="3"
                    fontWeight="bold"
                  >
                    TR
                  </text>
                  <text
                    x={result.corners.bottomRight.x * 100 - 5}
                    y={result.corners.bottomRight.y * 100 + 4}
                    fill="white"
                    fontSize="3"
                    fontWeight="bold"
                  >
                    BR
                  </text>
                  <text
                    x={result.corners.bottomLeft.x * 100 + 2}
                    y={result.corners.bottomLeft.y * 100 + 4}
                    fill="white"
                    fontSize="3"
                    fontWeight="bold"
                  >
                    BL
                  </text>
                </svg>
              )}
            </>
          ) : (
            <div className={css({ textAlign: 'center', color: 'gray.500', p: 4 })}>
              <div className={css({ fontSize: '3xl', mb: 2 })}>+</div>
              <div className={css({ fontSize: 'sm' })}>Click to upload a frame image</div>
              <div className={css({ fontSize: 'xs', mt: 2, color: 'gray.600' })}>
                From data/vision-training/boundary-frames/
              </div>
            </div>
          )}
        </div>

        {/* Run Inference Button */}
        {uploadedImage && (
          <button
            type="button"
            onClick={runInference}
            disabled={isLoading || !detector.isReady}
            className={css({
              w: '100%',
              py: 2,
              px: 4,
              bg: 'purple.600',
              color: 'white',
              borderRadius: 'md',
              border: 'none',
              cursor: 'pointer',
              fontWeight: 'medium',
              _hover: { bg: 'purple.500' },
              _disabled: { opacity: 0.5, cursor: 'not-allowed' },
            })}
          >
            {isLoading ? 'Running...' : 'Run Inference'}
          </button>
        )}

        {/* Error display */}
        {error && (
          <div
            className={css({
              p: 2,
              bg: 'red.900/30',
              border: '1px solid',
              borderColor: 'red.700',
              borderRadius: 'md',
              color: 'red.300',
              fontSize: 'sm',
            })}
          >
            {error}
          </div>
        )}

        {/* Results */}
        {result && (
          <div
            className={css({
              p: 3,
              bg: 'gray.800',
              borderRadius: 'md',
            })}
          >
            {/* Confidence */}
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                mb: 3,
              })}
            >
              <span className={css({ color: 'gray.400' })}>Confidence:</span>
              <span
                className={css({
                  fontSize: '2xl',
                  fontWeight: 'bold',
                  fontFamily: 'mono',
                  color: getConfidenceColor(result.confidence),
                })}
              >
                {(result.confidence * 100).toFixed(1)}%
              </span>
            </div>

            {/* Corner coordinates */}
            <div className={css({ fontSize: 'sm' })}>
              <div className={css({ color: 'gray.400', mb: 2, fontWeight: 'medium' })}>
                Corner Coordinates (normalized 0-1):
              </div>
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: 2,
                })}
              >
                <div className={css({ bg: 'gray.700', p: 2, borderRadius: 'md' })}>
                  <div className={css({ color: 'gray.500', fontSize: 'xs' })}>Top Left</div>
                  <div className={css({ fontFamily: 'mono', color: 'gray.200' })}>
                    ({result.corners.topLeft.x.toFixed(3)}, {result.corners.topLeft.y.toFixed(3)})
                  </div>
                </div>
                <div className={css({ bg: 'gray.700', p: 2, borderRadius: 'md' })}>
                  <div className={css({ color: 'gray.500', fontSize: 'xs' })}>Top Right</div>
                  <div className={css({ fontFamily: 'mono', color: 'gray.200' })}>
                    ({result.corners.topRight.x.toFixed(3)}, {result.corners.topRight.y.toFixed(3)})
                  </div>
                </div>
                <div className={css({ bg: 'gray.700', p: 2, borderRadius: 'md' })}>
                  <div className={css({ color: 'gray.500', fontSize: 'xs' })}>Bottom Left</div>
                  <div className={css({ fontFamily: 'mono', color: 'gray.200' })}>
                    ({result.corners.bottomLeft.x.toFixed(3)},{' '}
                    {result.corners.bottomLeft.y.toFixed(3)})
                  </div>
                </div>
                <div className={css({ bg: 'gray.700', p: 2, borderRadius: 'md' })}>
                  <div className={css({ color: 'gray.500', fontSize: 'xs' })}>Bottom Right</div>
                  <div className={css({ fontFamily: 'mono', color: 'gray.200' })}>
                    ({result.corners.bottomRight.x.toFixed(3)},{' '}
                    {result.corners.bottomRight.y.toFixed(3)})
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Info when no image uploaded */}
        {!uploadedImage && (
          <div className={css({ color: 'gray.500', fontSize: 'sm' })}>
            <p>Upload a frame image to test boundary detection.</p>
            <p className={css({ mt: 2, fontSize: 'xs' })}>
              Frame images are in:{' '}
              <code className={css({ color: 'gray.400' })}>
                data/vision-training/boundary-frames/{'<device>'}/
              </code>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Component for real-time camera testing of boundary detection
 */
function BoundaryCameraTester() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const lastInferenceTimeRef = useRef<number>(0)

  const [isRunning, setIsRunning] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    corners: QuadCorners
    confidence: number
  } | null>(null)
  const [fps, setFps] = useState(0)
  const [frameCount, setFrameCount] = useState(0)

  const detector = useBoundaryDetector({ enabled: true })

  // Start camera
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setCameraError(null)
      }
    } catch (err) {
      setCameraError(err instanceof Error ? err.message : 'Failed to access camera')
    }
  }, [])

  // Stop camera
  const stopCamera = useCallback(() => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach((track) => track.stop())
      videoRef.current.srcObject = null
    }
  }, [])

  // Run inference loop
  const runInferenceLoop = useCallback(() => {
    const loop = async () => {
      const now = performance.now()

      // Run inference at ~10 FPS
      if (now - lastInferenceTimeRef.current > 100) {
        lastInferenceTimeRef.current = now

        if (videoRef.current && videoRef.current.readyState >= 2) {
          const detectionResult = await detector.detectFromVideo(videoRef.current)

          if (detectionResult) {
            setResult({
              corners: detectionResult.corners,
              confidence: detectionResult.confidence,
            })
            setFrameCount((c) => c + 1)
          }
        }

        // Calculate FPS
        setFps(Math.round(1000 / (performance.now() - now)))
      }

      animationRef.current = requestAnimationFrame(loop)
    }

    animationRef.current = requestAnimationFrame(loop)
  }, [detector])

  // Draw corners overlay
  useEffect(() => {
    if (!result || !canvasRef.current || !videoRef.current) return

    const canvas = canvasRef.current
    const video = videoRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Match canvas size to video
    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480

    // Clear and draw overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const { corners, confidence } = result

    // Draw quadrilateral
    ctx.beginPath()
    ctx.moveTo(corners.topLeft.x * canvas.width, corners.topLeft.y * canvas.height)
    ctx.lineTo(corners.topRight.x * canvas.width, corners.topRight.y * canvas.height)
    ctx.lineTo(corners.bottomRight.x * canvas.width, corners.bottomRight.y * canvas.height)
    ctx.lineTo(corners.bottomLeft.x * canvas.width, corners.bottomLeft.y * canvas.height)
    ctx.closePath()

    // Fill with semi-transparent color based on confidence
    const fillColor =
      confidence >= 0.8
        ? 'rgba(34, 197, 94, 0.2)'
        : confidence >= 0.5
          ? 'rgba(234, 179, 8, 0.2)'
          : 'rgba(239, 68, 68, 0.2)'
    ctx.fillStyle = fillColor
    ctx.fill()

    // Stroke
    const strokeColor = confidence >= 0.8 ? '#22c55e' : confidence >= 0.5 ? '#eab308' : '#ef4444'
    ctx.strokeStyle = strokeColor
    ctx.lineWidth = 3
    ctx.stroke()

    // Draw corner markers
    const cornerPositions = [
      { pos: corners.topLeft, label: 'TL' },
      { pos: corners.topRight, label: 'TR' },
      { pos: corners.bottomRight, label: 'BR' },
      { pos: corners.bottomLeft, label: 'BL' },
    ]

    for (const { pos, label } of cornerPositions) {
      const x = pos.x * canvas.width
      const y = pos.y * canvas.height

      // Circle
      ctx.beginPath()
      ctx.arc(x, y, 8, 0, Math.PI * 2)
      ctx.fillStyle = strokeColor
      ctx.fill()
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 2
      ctx.stroke()

      // Label
      ctx.font = 'bold 12px sans-serif'
      ctx.fillStyle = 'white'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(label, x, y)
    }
  }, [result])

  // Toggle testing
  const toggleTesting = useCallback(async () => {
    if (isRunning) {
      // Stop
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      stopCamera()
      setIsRunning(false)
      setResult(null)
      setFrameCount(0)
    } else {
      // Start
      await startCamera()
      setIsRunning(true)
      runInferenceLoop()
    }
  }, [isRunning, startCamera, stopCamera, runInferenceLoop])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      stopCamera()
    }
  }, [stopCamera])

  // Get confidence color
  const getConfidenceColor = (conf: number) => {
    if (conf >= 0.8) return 'green.400'
    if (conf >= 0.5) return 'yellow.400'
    return 'red.400'
  }

  return (
    <div
      data-component="boundary-camera-tester"
      className={css({
        p: 4,
        bg: 'purple.900/20',
        border: '1px solid',
        borderColor: 'purple.700/50',
        borderRadius: 'lg',
      })}
    >
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          mb: 3,
        })}
      >
        <span className={css({ fontWeight: 'medium', color: 'purple.300' })}>Live Camera Test</span>
        <span className={css({ fontSize: 'xs', color: 'gray.500', ml: 'auto' })}>
          {detector.isReady ? (
            <span className={css({ color: 'green.400' })}>Model loaded</span>
          ) : detector.isLoading ? (
            <span className={css({ color: 'yellow.400' })}>Loading model...</span>
          ) : detector.isUnavailable ? (
            <span className={css({ color: 'red.400' })}>Model not available</span>
          ) : (
            <span className={css({ color: 'gray.400' })}>Model not loaded</span>
          )}
        </span>
      </div>

      {/* Video container with overlay */}
      <div
        className={css({
          position: 'relative',
          width: '100%',
          aspectRatio: '16/9',
          bg: 'gray.800',
          borderRadius: 'lg',
          overflow: 'hidden',
        })}
      >
        <video
          ref={videoRef}
          playsInline
          muted
          className={css({
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          })}
        />
        <canvas
          ref={canvasRef}
          className={css({
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          })}
        />

        {/* Overlay stats */}
        {isRunning && (
          <div
            className={css({
              position: 'absolute',
              top: 2,
              left: 2,
              px: 2,
              py: 1,
              bg: 'black/70',
              borderRadius: 'md',
              fontSize: 'xs',
              color: 'white',
              fontFamily: 'mono',
            })}
          >
            {fps} FPS - #{frameCount}
          </div>
        )}

        {/* Placeholder when not running */}
        {!isRunning && (
          <div
            className={css({
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexDirection: 'column',
              gap: 2,
              color: 'gray.500',
            })}
          >
            <span className={css({ fontSize: '3xl' })}>Camera</span>
            <span className={css({ fontSize: 'sm' })}>Click "Start Testing" to begin</span>
          </div>
        )}
      </div>

      {/* Camera error */}
      {cameraError && (
        <div
          className={css({
            mt: 3,
            p: 2,
            bg: 'red.900/30',
            border: '1px solid',
            borderColor: 'red.700',
            borderRadius: 'md',
            color: 'red.300',
            fontSize: 'sm',
          })}
        >
          {cameraError}
        </div>
      )}

      {/* Results */}
      {isRunning && result && (
        <div
          className={css({
            mt: 3,
            p: 3,
            bg: 'gray.800',
            borderRadius: 'md',
          })}
        >
          {/* Confidence */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: 3,
              mb: 3,
            })}
          >
            <span className={css({ color: 'gray.400' })}>Confidence:</span>
            <span
              className={css({
                fontSize: 'xl',
                fontWeight: 'bold',
                fontFamily: 'mono',
                color: getConfidenceColor(result.confidence),
              })}
            >
              {(result.confidence * 100).toFixed(1)}%
            </span>
          </div>

          {/* Corner coordinates */}
          <div className={css({ fontSize: 'xs' })}>
            <div className={css({ color: 'gray.400', mb: 1, fontWeight: 'medium' })}>
              Corners (normalized):
            </div>
            <div
              className={css({
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 1,
                fontFamily: 'mono',
                color: 'gray.300',
              })}
            >
              <span>
                TL: ({result.corners.topLeft.x.toFixed(2)}, {result.corners.topLeft.y.toFixed(2)})
              </span>
              <span>
                TR: ({result.corners.topRight.x.toFixed(2)}, {result.corners.topRight.y.toFixed(2)})
              </span>
              <span>
                BL: ({result.corners.bottomLeft.x.toFixed(2)},{' '}
                {result.corners.bottomLeft.y.toFixed(2)})
              </span>
              <span>
                BR: ({result.corners.bottomRight.x.toFixed(2)},{' '}
                {result.corners.bottomRight.y.toFixed(2)})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Start/Stop button */}
      <div className={css({ mt: 3, display: 'flex', justifyContent: 'center' })}>
        <button
          type="button"
          onClick={toggleTesting}
          disabled={detector.isLoading || detector.isUnavailable}
          className={css({
            px: 6,
            py: 2,
            bg: isRunning ? 'red.600' : 'purple.600',
            color: 'white',
            borderRadius: 'md',
            border: 'none',
            cursor: 'pointer',
            fontWeight: 'medium',
            _hover: { bg: isRunning ? 'red.500' : 'purple.500' },
            _disabled: { opacity: 0.5, cursor: 'not-allowed' },
          })}
        >
          {detector.isLoading
            ? 'Loading Model...'
            : detector.isUnavailable
              ? 'Model Not Available'
              : isRunning
                ? 'Stop Testing'
                : 'Start Testing'}
        </button>
      </div>
    </div>
  )
}
