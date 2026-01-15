'use client'

import { useState } from 'react'
import { CameraCapture } from '@/components/worksheets/CameraCapture'
import { css } from '../../../../../styled-system/css'

/**
 * Smartphone camera upload page
 *
 * Accessed via QR code scan from desktop
 * Provides streamlined photo capture experience
 * Auto-uploads to session as photos are taken
 */
export default function CameraUploadPage({ params }: { params: { sessionId: string } }) {
  const { sessionId } = params
  const [uploadCount, setUploadCount] = useState(0)
  const [lastUploadStatus, setLastUploadStatus] = useState<
    'idle' | 'uploading' | 'success' | 'error'
  >('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleCapture = async (file: File) => {
    setLastUploadStatus('uploading')
    setErrorMessage(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('sessionId', sessionId)

      const response = await fetch('/api/worksheets/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Upload failed')
      }

      const result = await response.json()
      console.log('Upload successful:', result)

      setUploadCount((prev) => prev + 1)
      setLastUploadStatus('success')

      // Reset success message after 2 seconds
      setTimeout(() => {
        setLastUploadStatus('idle')
      }, 2000)
    } catch (error) {
      console.error('Upload error:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Upload failed')
      setLastUploadStatus('error')
    }
  }

  return (
    <div
      data-component="camera-upload-page"
      className={css({
        minHeight: '100vh',
        bg: 'gray.100',
        p: 4,
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      {/* Header */}
      <header
        className={css({
          mb: 4,
          textAlign: 'center',
        })}
      >
        <h1
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'gray.800',
          })}
        >
          Upload Worksheets
        </h1>
        <p
          className={css({
            fontSize: 'sm',
            color: 'gray.600',
            mt: 1,
          })}
        >
          Take photos of completed worksheets
        </p>
      </header>

      {/* Upload count badge */}
      <div
        className={css({
          mb: 4,
          textAlign: 'center',
        })}
      >
        <div
          data-element="upload-count"
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: 2,
            px: 4,
            py: 2,
            bg: 'blue.500',
            color: 'white',
            borderRadius: 'full',
            fontSize: 'lg',
            fontWeight: 'bold',
          })}
        >
          <span>📸</span>
          <span>Photos: {uploadCount}</span>
        </div>
      </div>

      {/* Status message */}
      {lastUploadStatus !== 'idle' && (
        <div
          data-status={lastUploadStatus}
          className={css({
            mb: 4,
            p: 3,
            borderRadius: 'md',
            textAlign: 'center',
            fontWeight: 'medium',
            ...(lastUploadStatus === 'uploading' && {
              bg: 'blue.100',
              color: 'blue.700',
            }),
            ...(lastUploadStatus === 'success' && {
              bg: 'green.100',
              color: 'green.700',
            }),
            ...(lastUploadStatus === 'error' && {
              bg: 'red.100',
              color: 'red.700',
            }),
          })}
        >
          {lastUploadStatus === 'uploading' && '⏳ Uploading...'}
          {lastUploadStatus === 'success' && '✓ Uploaded! Tap to take next photo'}
          {lastUploadStatus === 'error' && (
            <>
              ✗ Upload failed
              {errorMessage && <div className={css({ fontSize: 'sm', mt: 1 })}>{errorMessage}</div>}
            </>
          )}
        </div>
      )}

      {/* Camera capture */}
      <div
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        })}
      >
        <CameraCapture onCapture={handleCapture} disabled={lastUploadStatus === 'uploading'} />
      </div>

      {/* Instructions */}
      <div
        className={css({
          mt: 4,
          p: 4,
          bg: 'white',
          borderRadius: 'md',
          border: '1px solid',
          borderColor: 'gray.200',
        })}
      >
        <h3
          className={css({
            fontSize: 'sm',
            fontWeight: 'bold',
            color: 'gray.700',
            mb: 2,
          })}
        >
          Tips for best results:
        </h3>
        <ul
          className={css({
            fontSize: 'sm',
            color: 'gray.600',
            ml: 4,
            '& li': {
              mb: 1,
            },
          })}
        >
          <li>Hold phone directly above worksheet</li>
          <li>Ensure good lighting (no shadows)</li>
          <li>Keep worksheet flat and fully visible</li>
          <li>Make sure text is in focus</li>
        </ul>
      </div>

      {/* Footer note */}
      <div
        className={css({
          mt: 4,
          textAlign: 'center',
          fontSize: 'xs',
          color: 'gray.500',
        })}
      >
        Session ID: {sessionId.slice(0, 8)}...
      </div>
    </div>
  )
}
