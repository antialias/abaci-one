'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../styled-system/css'
import { ModelTester } from '../train/components/ModelTester'
import { useColumnClassifier } from '@/hooks/useColumnClassifier'

/**
 * Quick model testing page - access the ModelTester directly without going through the training wizard.
 *
 * URL: /vision-training/test
 */
export default function TestModelPage() {
  return (
    <div
      data-component="test-model-page"
      className={css({
        minHeight: '100vh',
        bg: 'gray.900',
        color: 'gray.100',
      })}
    >
      {/* Header */}
      <header
        className={css({
          p: 4,
          borderBottom: '1px solid',
          borderColor: 'gray.800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        })}
      >
        <Link
          href="/vision-training"
          className={css({
            color: 'gray.400',
            textDecoration: 'none',
            fontSize: 'sm',
            _hover: { color: 'gray.200' },
          })}
        >
          ← Back to Training Data
        </Link>
        <Link
          href="/vision-training/train"
          className={css({
            color: 'purple.400',
            textDecoration: 'none',
            fontSize: 'sm',
            _hover: { color: 'purple.300' },
          })}
        >
          Training Wizard →
        </Link>
      </header>

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
          <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', mb: 2 })}>
            🔬 Model Tester
          </h1>
          <p className={css({ color: 'gray.400', fontSize: 'sm' })}>
            Test the trained model with live camera feed or uploaded images
          </p>
        </div>

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
      <div className={css({ display: 'flex', alignItems: 'center', gap: 2, mb: 3 })}>
        <span>📤</span>
        <span className={css({ fontWeight: 'medium', color: 'blue.300' })}>
          Upload Training Image
        </span>
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
              <div className={css({ fontSize: '2xl', mb: 1 })}>📁</div>
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
              {isLoading ? 'Running...' : '🔍 Run Inference'}
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
              <div className={css({ display: 'flex', alignItems: 'center', gap: 3, mb: 3 })}>
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
                      {isCorrect ? '✅' : '❌'}
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
                digit = heaven × 5 + earth = {result.heaven} × 5 + {result.earth} = {result.digit}
              </div>
            </div>
          )}

          {!uploadedImage && (
            <div className={css({ color: 'gray.500', fontSize: 'sm' })}>
              <p>Upload a training image (64×128 PNG) to test inference.</p>
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
