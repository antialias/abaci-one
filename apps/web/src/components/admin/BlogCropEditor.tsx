'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../styled-system/css'

interface BlogCropEditorProps {
  slug: string
  imageUrl: string
  currentCrop: string | null
  onSave: (crop: string) => void
  onClose: () => void
}

/** Parse an object-position string like "50% 30%" into {x, y} percentages. */
function parseCrop(crop: string | null): { x: number; y: number } {
  if (!crop) return { x: 50, y: 50 }
  // Handle named positions
  const named: Record<string, { x: number; y: number }> = {
    top: { x: 50, y: 0 },
    bottom: { x: 50, y: 100 },
    left: { x: 0, y: 50 },
    right: { x: 100, y: 50 },
    center: { x: 50, y: 50 },
  }
  if (named[crop]) return named[crop]
  const parts = crop.split(/\s+/)
  const x = parseFloat(parts[0]) || 50
  const y = parseFloat(parts[1] ?? parts[0]) || 50
  return { x, y }
}

/**
 * BlogCropEditor — focal-point picker for blog hero images.
 *
 * Shows the full uncropped image with a crosshair overlay.
 * Click to set the focal point. A live 2.4:1 preview shows
 * how the crop will look on the blog listing. Auto-saves with
 * a 500ms debounce.
 */
export function BlogCropEditor({
  slug,
  imageUrl,
  currentCrop,
  onSave,
  onClose,
}: BlogCropEditorProps) {
  const [focal, setFocal] = useState(() => parseCrop(currentCrop))
  const lastSavedRef = useRef(currentCrop ?? '')
  const [saveError, setSaveError] = useState<string | null>(null)
  const imageContainerRef = useRef<HTMLDivElement>(null)

  const cropValue = `${focal.x.toFixed(1)}% ${focal.y.toFixed(1)}%`

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setFocal({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 })
  }, [])

  // Debounced auto-save
  useEffect(() => {
    if (cropValue === lastSavedRef.current) return

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/blog/${slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ heroCrop: cropValue }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error || `HTTP ${res.status}`)
        }
        lastSavedRef.current = cropValue
        setSaveError(null)
        onSave(cropValue)
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Save failed')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [cropValue, slug, onSave])

  const dirty = cropValue !== lastSavedRef.current

  return (
    <div
      data-component="blog-crop-editor"
      className={css({
        padding: '16px',
        backgroundColor: '#0d1117',
        borderRadius: '8px',
        border: '1px solid #30363d',
        marginTop: '8px',
      })}
    >
      {/* Header */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '12px',
        })}
      >
        <div className={css({ fontSize: '13px', color: '#8b949e' })}>
          Focal point: <code className={css({ color: '#c9d1d9' })}>{cropValue}</code>
          {dirty && !saveError && (
            <span className={css({ marginLeft: '8px', color: '#d29922', fontSize: '12px' })}>
              Saving...
            </span>
          )}
          {saveError && (
            <span className={css({ marginLeft: '8px', color: '#f85149', fontSize: '12px' })}>
              Save failed: {saveError}
            </span>
          )}
        </div>
        <button
          data-action="close-crop-editor"
          onClick={onClose}
          className={css({
            backgroundColor: '#21262d',
            color: '#c9d1d9',
            border: '1px solid #30363d',
            borderRadius: '6px',
            padding: '4px 12px',
            fontSize: '12px',
            cursor: 'pointer',
            '&:hover': { backgroundColor: '#30363d' },
          })}
        >
          Close
        </button>
      </div>

      <div className={css({ display: 'flex', gap: '16px', flexWrap: 'wrap' })}>
        {/* Full image with crosshair */}
        <div className={css({ flex: '1 1 300px', minWidth: '0' })}>
          <div
            className={css({
              fontSize: '11px',
              color: '#484f58',
              marginBottom: '4px',
            })}
          >
            Click to set focal point
          </div>
          <div
            ref={imageContainerRef}
            data-element="focal-picker"
            onClick={handleClick}
            className={css({
              position: 'relative',
              cursor: 'crosshair',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #21262d',
            })}
          >
            <img
              src={imageUrl}
              alt="Full hero"
              className={css({
                width: '100%',
                display: 'block',
              })}
            />
            {/* Crosshair overlay */}
            <div
              data-element="crosshair"
              style={{
                position: 'absolute',
                left: `${focal.x}%`,
                top: `${focal.y}%`,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
              }}
            >
              {/* Horizontal line */}
              <div
                style={{
                  position: 'absolute',
                  width: '24px',
                  height: '2px',
                  backgroundColor: '#f85149',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 4px rgba(0,0,0,0.8)',
                }}
              />
              {/* Vertical line */}
              <div
                style={{
                  position: 'absolute',
                  width: '2px',
                  height: '24px',
                  backgroundColor: '#f85149',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 4px rgba(0,0,0,0.8)',
                }}
              />
              {/* Center dot */}
              <div
                style={{
                  position: 'absolute',
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#f85149',
                  border: '2px solid #fff',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  boxShadow: '0 0 4px rgba(0,0,0,0.8)',
                }}
              />
            </div>
          </div>
        </div>

        {/* Live 2.4:1 preview */}
        <div className={css({ flex: '1 1 300px', minWidth: '0' })}>
          <div
            className={css({
              fontSize: '11px',
              color: '#484f58',
              marginBottom: '4px',
            })}
          >
            Preview (2.4 : 1 crop)
          </div>
          <div
            data-element="crop-preview"
            className={css({
              width: '100%',
              aspectRatio: '2.4',
              borderRadius: '6px',
              overflow: 'hidden',
              border: '1px solid #21262d',
            })}
          >
            <img
              src={imageUrl}
              alt="Crop preview"
              style={{ objectPosition: cropValue }}
              className={css({
                width: '100%',
                height: '100%',
                objectFit: 'cover',
              })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
