'use client'

import { OrbitControls, Stage } from '@react-three/drei'
import { Canvas, useLoader } from '@react-three/fiber'
import { Suspense, useEffect, useRef, useState } from 'react'
// @ts-expect-error - STLLoader doesn't have TypeScript declarations
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { css } from '../../../styled-system/css'

interface STLModelProps {
  url: string
}

function STLModel({ url }: STLModelProps) {
  const geometry = useLoader(STLLoader, url)

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#8b7355" metalness={0.1} roughness={0.6} />
    </mesh>
  )
}

interface STLPreviewProps {
  columns: number
  scaleFactor: number
}

export function STLPreview({ columns, scaleFactor }: STLPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('/3d-models/simplified.abacus.stl')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const workerRef = useRef<Worker | null>(null)

  // Initialize worker
  useEffect(() => {
    const worker = new Worker(new URL('../../workers/openscad.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.onmessage = (event: MessageEvent) => {
      const { data } = event

      switch (data.type) {
        case 'ready':
          console.log('[STLPreview] Worker ready')
          break

        case 'result': {
          // Create blob from STL data
          const blob = new Blob([data.stl], { type: 'application/octet-stream' })
          const objectUrl = URL.createObjectURL(blob)

          // Revoke old URL if it exists
          if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl)
          }

          setPreviewUrl(objectUrl)
          setIsGenerating(false)
          setError(null)
          break
        }

        case 'error':
          console.error('[STLPreview] Worker error:', data.error)
          setError(data.error)
          setIsGenerating(false)
          // Fallback to showing the base STL
          setPreviewUrl('/3d-models/simplified.abacus.stl')
          break

        default:
          console.warn('[STLPreview] Unknown message type:', data)
      }
    }

    worker.onerror = (error) => {
      console.error('[STLPreview] Worker error:', error)
      setError('Worker failed to load')
      setIsGenerating(false)
    }

    workerRef.current = worker

    return () => {
      worker.terminate()
      workerRef.current = null
      // Clean up any blob URLs
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [])

  // Trigger rendering when parameters change
  useEffect(() => {
    if (!workerRef.current) return

    setIsGenerating(true)
    setError(null)

    // Debounce: Wait 500ms after parameters change before regenerating
    const timeoutId = setTimeout(() => {
      workerRef.current?.postMessage({
        type: 'render',
        columns,
        scaleFactor,
      })
    }, 500)

    return () => {
      clearTimeout(timeoutId)
    }
  }, [columns, scaleFactor])

  return (
    <div
      data-component="stl-preview"
      className={css({
        position: 'relative',
        width: '100%',
        height: '500px',
        bg: 'gray.900',
        borderRadius: '8px',
        overflow: 'hidden',
      })}
    >
      {isGenerating && (
        <div
          className={css({
            position: 'absolute',
            top: 4,
            right: 4,
            left: 4,
            zIndex: 10,
            bg: 'blue.600',
            color: 'white',
            px: 3,
            py: 2,
            borderRadius: '4px',
            fontSize: 'sm',
            fontWeight: 'bold',
          })}
        >
          <div className={css({ display: 'flex', alignItems: 'center', gap: 2 })}>
            <div
              className={css({
                width: '16px',
                height: '16px',
                border: '2px solid white',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
              })}
            />
            <span>Rendering preview (may take 30-60 seconds)...</span>
          </div>
        </div>
      )}
      {error && (
        <div
          className={css({
            position: 'absolute',
            top: 4,
            right: 4,
            left: 4,
            zIndex: 10,
            bg: 'red.600',
            color: 'white',
            px: 3,
            py: 2,
            borderRadius: '4px',
            fontSize: 'sm',
            fontWeight: 'bold',
          })}
        >
          <div>Preview Error:</div>
          <div className={css({ fontSize: 'xs', mt: 1, opacity: 0.9 })}>{error}</div>
        </div>
      )}
      <Canvas camera={{ position: [0, 0, 100], fov: 50 }}>
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="orange" />
            </mesh>
          }
        >
          <Stage environment="city" intensity={0.6}>
            <STLModel url={previewUrl} key={previewUrl} />
          </Stage>
          <OrbitControls makeDefault />
        </Suspense>
      </Canvas>
    </div>
  )
}
