'use client'

import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import { useEffect, useState } from 'react'
import { AbacusQRCode } from '@/components/common/AbacusQRCode'
import type { WorksheetFormState } from '../types'
import { extractConfigFields } from '../utils/extractConfigFields'

interface ShareModalProps {
  isOpen: boolean
  onClose: () => void
  worksheetType: string
  config: WorksheetFormState
  isDark?: boolean
}

export function ShareModal({
  isOpen,
  onClose,
  worksheetType,
  config,
  isDark = false,
}: ShareModalProps) {
  const [shareUrl, setShareUrl] = useState<string>('')
  const [shareId, setShareId] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string>('')
  const [copied, setCopied] = useState(false)

  // Auto-generate share link when modal opens
  useEffect(() => {
    if (!isOpen) return

    const generateShare = async () => {
      setIsGenerating(true)
      setError('')

      try {
        const extractedConfig = extractConfigFields(config)
        console.log('[ShareModal] Creating share with config:', {
          pages: extractedConfig.pages,
          problemsPerPage: extractedConfig.problemsPerPage,
          totalProblems: (extractedConfig.pages || 0) * (extractedConfig.problemsPerPage || 0),
        })

        const response = await fetch('/api/worksheets/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            worksheetType,
            config: extractedConfig,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to create share link')
        }

        const data = await response.json()
        setShareUrl(data.url)
        setShareId(data.id)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create share link')
      } finally {
        setIsGenerating(false)
      }
    }

    generateShare()
  }, [isOpen, worksheetType, config])

  if (!isOpen) return null

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleClose = () => {
    setShareUrl('')
    setShareId('')
    setError('')
    setCopied(false)
    onClose()
  }

  return (
    <div
      data-component="share-modal"
      className={css({
        position: 'fixed',
        inset: 0,
        bg: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        p: '4',
      })}
      onClick={handleClose}
    >
      <div
        className={css({
          bg: isDark ? 'gray.800' : 'white',
          rounded: 'xl',
          shadow: 'xl',
          maxW: 'lg',
          w: 'full',
          p: '6',
        })}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={stack({ gap: '4' })}>
          {/* Header */}
          <div>
            <h2
              className={css({
                fontSize: '2xl',
                fontWeight: 'bold',
                color: isDark ? 'gray.100' : 'gray.900',
                mb: '2',
              })}
            >
              Share Worksheet
            </h2>
            <p
              className={css({
                fontSize: 'sm',
                color: isDark ? 'gray.400' : 'gray.600',
              })}
            >
              Create a shareable link to this exact worksheet configuration. Anyone with the link
              can view and generate this worksheet.
            </p>
          </div>

          {/* Loading or Share URL */}
          {isGenerating ? (
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '3',
                py: '6',
              })}
            >
              <div
                className={css({
                  w: '12',
                  h: '12',
                  border: '4px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                  borderTopColor: 'brand.600',
                  rounded: 'full',
                  animation: 'spin 1s linear infinite',
                })}
              />
              <p
                className={css({
                  fontSize: 'sm',
                  color: isDark ? 'gray.400' : 'gray.600',
                })}
              >
                Generating share link...
              </p>
            </div>
          ) : shareUrl ? (
            <div className={stack({ gap: '4' })}>
              {/* QR Code with Abacus Logo */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'center',
                  py: '2',
                })}
              >
                <div
                  className={css({
                    bg: 'white',
                    p: '5',
                    rounded: 'xl',
                    border: '3px solid',
                    borderColor: 'brand.400',
                    boxShadow: '0 4px 16px rgba(251, 146, 60, 0.2)',
                  })}
                >
                  <AbacusQRCode
                    value={shareUrl}
                    size={220}
                    fgColor={isDark ? '#1f2937' : '#111827'}
                  />
                </div>
              </div>

              {/* Share URL Display */}
              <div
                className={css({
                  bg: isDark ? 'gray.700' : 'gray.100',
                  p: '4',
                  rounded: 'lg',
                  border: '2px solid',
                  borderColor: isDark ? 'gray.600' : 'gray.300',
                })}
              >
                <div
                  className={css({
                    fontSize: 'xs',
                    fontWeight: 'semibold',
                    color: isDark ? 'gray.400' : 'gray.600',
                    mb: '2',
                  })}
                >
                  SHARE LINK
                </div>
                <code
                  className={css({
                    fontSize: 'sm',
                    color: isDark ? 'gray.200' : 'gray.800',
                    wordBreak: 'break-all',
                  })}
                >
                  {shareUrl}
                </code>
              </div>

              {/* Copy Button */}
              <button
                onClick={handleCopy}
                className={css({
                  w: 'full',
                  px: '6',
                  py: '3',
                  bg: copied ? 'green.600' : 'brand.600',
                  color: 'white',
                  fontSize: 'md',
                  fontWeight: 'bold',
                  rounded: 'lg',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  _hover: {
                    bg: copied ? 'green.700' : 'brand.700',
                  },
                })}
              >
                {copied ? '✓ Copied!' : 'Copy Link'}
              </button>

              {/* Share ID Info */}
              <p
                className={css({
                  fontSize: 'xs',
                  color: isDark ? 'gray.500' : 'gray.500',
                  textAlign: 'center',
                })}
              >
                Share ID: <code>{shareId}</code>
              </p>
            </div>
          ) : null}

          {/* Error Message */}
          {error && (
            <div
              className={css({
                bg: 'red.50',
                border: '2px solid',
                borderColor: 'red.300',
                color: 'red.800',
                p: '3',
                rounded: 'lg',
                fontSize: 'sm',
              })}
            >
              {error}
            </div>
          )}

          {/* Close Button */}
          <button
            onClick={handleClose}
            className={css({
              w: 'full',
              px: '4',
              py: '2',
              bg: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'gray.300' : 'gray.700',
              fontSize: 'sm',
              fontWeight: 'medium',
              rounded: 'lg',
              transition: 'all 0.2s',
              cursor: 'pointer',
              _hover: {
                bg: isDark ? 'gray.600' : 'gray.300',
              },
            })}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
