'use client'

import { OrbitControls, Stage } from '@react-three/drei'
import { Canvas, useLoader } from '@react-three/fiber'
import { Suspense, useEffect, useState } from 'react'
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

  useEffect(() => {
    let mounted = true

    const generatePreview = async () => {
      setIsGenerating(true)
      setError(null)

      try {
        const response = await fetch('/api/abacus/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ columns, scaleFactor }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate preview')
        }

        // Convert response to blob and create object URL
        const blob = await response.blob()
        const objectUrl = URL.createObjectURL(blob)

        if (mounted) {
          // Revoke old URL if it exists
          if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl)
          }
          setPreviewUrl(objectUrl)
        } else {
          // Component unmounted, clean up the URL
          URL.revokeObjectURL(objectUrl)
        }
      } catch (err) {
        if (mounted) {
          const errorMessage = err instanceof Error ? err.message : 'Failed to generate preview'

          // Check if this is an OpenSCAD not found error
          if (
            errorMessage.includes('openscad: command not found') ||
            errorMessage.includes('Command failed: openscad')
          ) {
            setError('OpenSCAD not installed (preview only available in production/Docker)')
            // Fallback to showing the base STL
            setPreviewUrl('/3d-models/simplified.abacus.stl')
          } else {
            setError(errorMessage)
          }
          console.error('Preview generation error:', err)
        }
      } finally {
        if (mounted) {
          setIsGenerating(false)
        }
      }
    }

    // Debounce: Wait 1 second after parameters change before regenerating
    const timeoutId = setTimeout(generatePreview, 1000)

    return () => {
      mounted = false
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
