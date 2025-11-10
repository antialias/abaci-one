'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraCapture } from './CameraCapture'
import { QRCodeDisplay } from './QRCodeDisplay'
import { css } from '../../../styled-system/css'

// Browser-compatible UUID generation
function generateUUID(): string {
  return crypto.randomUUID()
}

interface UploadWorksheetModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete?: (attemptId: string) => void
}

type UploadMode = 'file' | 'camera' | 'qr'

interface SessionUpload {
  id: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  uploadedAt: Date
}

/**
 * Upload worksheet modal with three modes:
 * 1. File upload (drag & drop or browse)
 * 2. Desktop camera (webcam capture)
 * 3. QR code (smartphone batch upload)
 */
export function UploadWorksheetModal({
  isOpen,
  onClose,
  onUploadComplete,
}: UploadWorksheetModalProps) {
  const [mode, setMode] = useState<UploadMode>('file')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // QR mode state
  const [sessionId] = useState(() => generateUUID())
  const [sessionUploads, setSessionUploads] = useState<SessionUpload[]>([])
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Poll for session uploads when in QR mode
  useEffect(() => {
    if (mode === 'qr' && isOpen) {
      // Start polling
      const pollSession = async () => {
        try {
          const response = await fetch(`/api/worksheets/sessions/${sessionId}`)
          if (response.ok) {
            const data = await response.json()
            setSessionUploads(
              data.attempts.map((a: any) => ({
                id: a.id,
                status: a.status,
                uploadedAt: new Date(a.uploadedAt),
              }))
            )
          }
        } catch (err) {
          console.error('Failed to poll session:', err)
        }
      }

      // Poll immediately, then every 2 seconds
      pollSession()
      pollingIntervalRef.current = setInterval(pollSession, 2000)

      return () => {
        if (pollingIntervalRef.current) {
          clearInterval(pollingIntervalRef.current)
        }
      }
    }
  }, [mode, isOpen, sessionId])

  const handleFileUpload = useCallback(
    async (file: File) => {
      setIsUploading(true)
      setError(null)

      try {
        const formData = new FormData()
        formData.append('image', file)

        const response = await fetch('/api/worksheets/upload', {
          method: 'POST',
          body: formData,
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const result = await response.json()
        onUploadComplete?.(result.attemptId)
        onClose()
      } catch (err) {
        console.error('Upload error:', err)
        setError(err instanceof Error ? err.message : 'Upload failed')
      } finally {
        setIsUploading(false)
      }
    },
    [onUploadComplete, onClose]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const file = e.dataTransfer.files[0]
      if (file && file.type.startsWith('image/')) {
        handleFileUpload(file)
      } else {
        setError('Please upload an image file (JPG, PNG, HEIC)')
      }
    },
    [handleFileUpload]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) {
        handleFileUpload(file)
      }
    },
    [handleFileUpload]
  )

  if (!isOpen) return null

  return (
    <div
      data-component="upload-worksheet-modal"
      className={css({
        position: 'fixed',
        inset: 0,
        bg: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        p: 4,
      })}
      onClick={onClose}
    >
      <div
        className={css({
          bg: 'white',
          borderRadius: 'lg',
          maxW: '2xl',
          w: '100%',
          maxH: '90vh',
          overflowY: 'auto',
          boxShadow: 'xl',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={css({
            p: 6,
            borderBottom: '1px solid',
            borderColor: 'gray.200',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <h2
            className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: 'gray.800',
            })}
          >
            Upload Completed Worksheet
          </h2>
          <button
            data-action="close-modal"
            onClick={onClose}
            className={css({
              fontSize: '2xl',
              color: 'gray.400',
              cursor: 'pointer',
              _hover: { color: 'gray.600' },
            })}
          >
            ×
          </button>
        </div>

        {/* Mode tabs */}
        <div
          className={css({
            display: 'flex',
            borderBottom: '1px solid',
            borderColor: 'gray.200',
          })}
        >
          {(['file', 'camera', 'qr'] as const).map((tabMode) => (
            <button
              key={tabMode}
              data-action={`select-${tabMode}-mode`}
              onClick={() => setMode(tabMode)}
              className={css({
                flex: 1,
                py: 3,
                px: 4,
                fontSize: 'md',
                fontWeight: 'medium',
                cursor: 'pointer',
                borderBottom: '2px solid',
                borderColor: mode === tabMode ? 'blue.500' : 'transparent',
                color: mode === tabMode ? 'blue.600' : 'gray.600',
                bg: mode === tabMode ? 'blue.50' : 'transparent',
                _hover: { bg: mode === tabMode ? 'blue.50' : 'gray.50' },
              })}
            >
              {tabMode === 'file' && '📁 File'}
              {tabMode === 'camera' && '📷 Camera'}
              {tabMode === 'qr' && '📱 Phone QR'}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className={css({ p: 6 })}>
          {/* File upload mode */}
          {mode === 'file' && (
            <div data-section="file-upload">
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className={css({
                  border: '2px dashed',
                  borderColor: 'gray.300',
                  borderRadius: 'lg',
                  p: 12,
                  textAlign: 'center',
                  cursor: 'pointer',
                  _hover: { borderColor: 'blue.400', bg: 'blue.50' },
                })}
              >
                <div
                  className={css({
                    fontSize: '4xl',
                    mb: 4,
                  })}
                >
                  📄
                </div>
                <p
                  className={css({
                    fontSize: 'lg',
                    color: 'gray.700',
                    mb: 2,
                  })}
                >
                  Drop worksheet image here
                </p>
                <p
                  className={css({
                    fontSize: 'sm',
                    color: 'gray.500',
                    mb: 4,
                  })}
                >
                  or click to browse
                </p>
                <p
                  className={css({
                    fontSize: 'xs',
                    color: 'gray.400',
                  })}
                >
                  JPG, PNG, HEIC • Max 10MB
                </p>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  disabled={isUploading}
                  className={css({
                    display: 'none',
                  })}
                  id="file-input"
                />
              </div>
              <label htmlFor="file-input">
                <button
                  data-action="choose-file"
                  onClick={() => document.getElementById('file-input')?.click()}
                  disabled={isUploading}
                  className={css({
                    mt: 4,
                    w: '100%',
                    py: 3,
                    bg: 'blue.500',
                    color: 'white',
                    borderRadius: 'md',
                    fontWeight: 'medium',
                    cursor: 'pointer',
                    _hover: { bg: 'blue.600' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  {isUploading ? 'Uploading...' : 'Choose File'}
                </button>
              </label>
            </div>
          )}

          {/* Camera mode */}
          {mode === 'camera' && (
            <div data-section="camera-capture">
              <CameraCapture onCapture={handleFileUpload} disabled={isUploading} />
            </div>
          )}

          {/* QR mode */}
          {mode === 'qr' && (
            <div data-section="qr-code">
              <QRCodeDisplay
                sessionId={sessionId}
                uploadCount={sessionUploads.length}
                uploads={sessionUploads}
              />
            </div>
          )}

          {/* Error message */}
          {error && (
            <div
              data-status="error"
              className={css({
                mt: 4,
                p: 3,
                bg: 'red.50',
                border: '1px solid',
                borderColor: 'red.200',
                borderRadius: 'md',
                color: 'red.700',
                fontSize: 'sm',
              })}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
