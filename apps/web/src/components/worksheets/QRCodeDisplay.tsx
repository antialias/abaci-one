'use client'

import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { css } from '../../../styled-system/css'

interface QRCodeDisplayProps {
  sessionId: string
  uploadCount: number
  uploads: Array<{
    id: string
    status: 'pending' | 'processing' | 'completed' | 'failed'
    uploadedAt: Date
  }>
}

/**
 * QR code display for batch upload workflow
 *
 * Shows QR code that links to camera upload page
 * Displays real-time list of uploads as phone sends them
 */
export function QRCodeDisplay({ sessionId, uploadCount, uploads }: QRCodeDisplayProps) {
  const [copied, setCopied] = useState(false)

  // Generate upload URL for smartphone
  const uploadUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/upload/${sessionId}/camera`

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(uploadUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy URL:', err)
    }
  }

  return (
    <div
      data-component="qr-code-display"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        alignItems: 'center',
      })}
    >
      {/* Instructions */}
      <div
        className={css({
          textAlign: 'center',
          color: 'gray.700',
        })}
      >
        <h3
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            mb: 2,
          })}
        >
          Scan with your phone
        </h3>
        <p className={css({ fontSize: 'sm', color: 'gray.600' })}>
          Camera will open automatically. Take multiple photos to batch upload.
        </p>
      </div>

      {/* QR Code */}
      <div
        data-element="qr-code"
        className={css({
          p: 4,
          bg: 'white',
          borderRadius: 'lg',
          border: '2px solid',
          borderColor: 'gray.200',
        })}
      >
        <QRCodeSVG
          value={uploadUrl}
          size={200}
          level="M"
          includeMargin={false}
          className={css({
            display: 'block',
          })}
        />
      </div>

      {/* URL with copy button */}
      <div
        className={css({
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          width: '100%',
          maxW: 'md',
        })}
      >
        <input
          type="text"
          value={uploadUrl}
          readOnly
          className={css({
            flex: 1,
            px: 3,
            py: 2,
            bg: 'gray.50',
            border: '1px solid',
            borderColor: 'gray.300',
            borderRadius: 'md',
            fontSize: 'xs',
            fontFamily: 'mono',
            color: 'gray.700',
          })}
        />
        <button
          data-action="copy-url"
          onClick={copyUrl}
          className={css({
            px: 4,
            py: 2,
            bg: copied ? 'green.500' : 'blue.500',
            color: 'white',
            borderRadius: 'md',
            fontSize: 'sm',
            fontWeight: 'medium',
            cursor: 'pointer',
            transition: 'background 0.2s',
            _hover: {
              bg: copied ? 'green.600' : 'blue.600',
            },
          })}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Upload count */}
      <div
        data-element="upload-count"
        className={css({
          fontSize: 'sm',
          fontWeight: 'medium',
          color: 'gray.600',
        })}
      >
        Worksheets uploaded: <span className={css({ fontWeight: 'bold' })}>{uploadCount}</span>
      </div>

      {/* Upload list */}
      {uploads.length > 0 && (
        <div
          data-section="upload-list"
          className={css({
            width: '100%',
            maxW: 'md',
            maxH: '300px',
            overflowY: 'auto',
            border: '1px solid',
            borderColor: 'gray.200',
            borderRadius: 'md',
            bg: 'gray.50',
          })}
        >
          {uploads.map((upload, index) => (
            <div
              key={upload.id}
              data-element="upload-item"
              className={css({
                p: 3,
                borderBottom: '1px solid',
                borderColor: 'gray.200',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                _last: {
                  borderBottom: 'none',
                },
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                })}
              >
                <span className={css({ fontWeight: 'medium', color: 'gray.700' })}>
                  Worksheet {index + 1}
                </span>
                <StatusBadge status={upload.status} />
              </div>
              <a
                href={`/worksheets/attempts/${upload.id}`}
                className={css({
                  px: 3,
                  py: 1,
                  bg: 'blue.500',
                  color: 'white',
                  borderRadius: 'md',
                  fontSize: 'xs',
                  fontWeight: 'medium',
                  textDecoration: 'none',
                  cursor: 'pointer',
                  _hover: { bg: 'blue.600' },
                })}
              >
                View
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: 'pending' | 'processing' | 'completed' | 'failed' }) {
  const colors = {
    pending: { bg: 'yellow.100', color: 'yellow.700', text: 'Pending' },
    processing: { bg: 'blue.100', color: 'blue.700', text: 'Grading...' },
    completed: { bg: 'green.100', color: 'green.700', text: 'Done' },
    failed: { bg: 'red.100', color: 'red.700', text: 'Failed' },
  }

  const style = colors[status]

  return (
    <span
      data-status={status}
      className={css({
        px: 2,
        py: 0.5,
        bg: style.bg,
        color: style.color,
        borderRadius: 'sm',
        fontSize: 'xs',
        fontWeight: 'medium',
      })}
    >
      {style.text}
    </span>
  )
}
