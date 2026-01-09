'use client'

import * as Dialog from '@radix-ui/react-dialog'
import { useCallback, useEffect, useState } from 'react'
import { css } from '../../../../../styled-system/css'
import { Z_INDEX } from '@/constants/zIndex'
import type { QuadCorners } from '@/types/vision'
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

interface BoundaryDataHubModalProps {
  isOpen: boolean
  onClose: () => void
  onDataChanged: () => void
}

type ViewMode = 'browse' | 'capture'

/**
 * Boundary Data Hub Modal
 *
 * Management interface for boundary detector training data.
 * - Browse captured frames with corner annotations
 * - Delete bad frames
 * - Capture new frames
 */
export function BoundaryDataHubModal({
  isOpen,
  onClose,
  onDataChanged,
}: BoundaryDataHubModalProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('browse')
  const [frames, setFrames] = useState<BoundaryFrame[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedFrame, setSelectedFrame] = useState<BoundaryFrame | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  // Load frames when modal opens
  const loadFrames = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/vision-training/boundary-samples?list=true')
      if (response.ok) {
        const data = await response.json()
        setFrames(data.frames || [])
      }
    } catch (error) {
      console.error('[BoundaryDataHubModal] Failed to load frames:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      loadFrames()
    }
  }, [isOpen, loadFrames])

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
          onDataChanged()
        } else {
          alert('Failed to delete frame')
        }
      } catch (error) {
        console.error('[BoundaryDataHubModal] Delete error:', error)
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
    onDataChanged()
  }, [loadFrames, onDataChanged])

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={css({
            position: 'fixed',
            inset: 0,
            bg: 'black/80',
            animation: 'fadeIn 0.2s ease-out',
          })}
          style={{ zIndex: Z_INDEX.MODAL }}
        />
        <Dialog.Content
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '95vw',
            maxWidth: '1000px',
            maxHeight: '90vh',
            bg: 'gray.900',
            borderRadius: 'xl',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'scaleIn 0.2s ease-out',
          })}
          style={{ zIndex: Z_INDEX.MODAL + 1 }}
        >
          {/* Header */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              p: 4,
              borderBottom: '1px solid',
              borderColor: 'gray.800',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: 3 })}>
              <span className={css({ fontSize: 'xl' })}>🎯</span>
              <div>
                <Dialog.Title
                  className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'gray.100' })}
                >
                  Boundary Training Data
                </Dialog.Title>
                <div className={css({ fontSize: 'sm', color: 'gray.400' })}>
                  {frames.length} {frames.length === 1 ? 'frame' : 'frames'} captured
                </div>
              </div>
            </div>
            <Dialog.Close
              className={css({
                p: 2,
                bg: 'transparent',
                border: 'none',
                color: 'gray.400',
                cursor: 'pointer',
                borderRadius: 'md',
                _hover: { color: 'gray.200', bg: 'gray.800' },
              })}
            >
              ✕
            </Dialog.Close>
          </div>

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
                <div className={css({ fontSize: '2xl', animation: 'spin 1s linear infinite' })}>
                  ⏳
                </div>
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
                        aspectRatio: '4/3',
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
                          objectFit: 'cover',
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
                      <div
                        className={css({ color: 'gray.200', fontFamily: 'mono', fontSize: 'xs' })}
                      >
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
