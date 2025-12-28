'use client'

import * as Popover from '@radix-ui/react-popover'
import { useCallback, useEffect, useState } from 'react'
import { Z_INDEX } from '@/constants/zIndex'
import { getShareUrl } from '@/lib/share/urls'
import { css } from '../../../styled-system/css'
import { AbacusQRCode } from '../common/AbacusQRCode'
import { CopyButton } from '../common/CopyButton'

interface ShareInfo {
  token: string
  url: string
  expiresAt: number
  viewCount?: number
  createdAt?: number
}

interface SessionShareButtonProps {
  sessionId: string
  isDark: boolean
}

function formatTimeRemaining(expiresAt: number): string {
  const remaining = expiresAt - Date.now()
  if (remaining <= 0) return 'Expired'
  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

function formatCreatedAt(createdAt: number): string {
  const now = Date.now()
  const diff = now - createdAt
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return new Date(createdAt).toLocaleDateString()
}

export function SessionShareButton({ sessionId, isDark }: SessionShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [expiresIn, setExpiresIn] = useState<'1h' | '24h'>('1h')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedShare, setGeneratedShare] = useState<ShareInfo | null>(null)
  const [activeShares, setActiveShares] = useState<ShareInfo[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fetch active shares when popover opens
  useEffect(() => {
    if (isOpen) {
      fetchActiveShares()
    }
  }, [isOpen, sessionId])

  const fetchActiveShares = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`)
      if (response.ok) {
        const data = await response.json()
        setActiveShares(
          data.shares.map(
            (s: { token: string; expiresAt: number; viewCount?: number; createdAt?: number }) => ({
              token: s.token,
              url: getShareUrl('observe', s.token),
              expiresAt: s.expiresAt,
              viewCount: s.viewCount,
              createdAt: s.createdAt,
            })
          )
        )
      }
    } catch (err) {
      console.error('Failed to fetch active shares:', err)
    }
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expiresIn }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to generate share link')
      }

      const data = await response.json()
      const share: ShareInfo = {
        token: data.token,
        url: data.url,
        expiresAt: data.expiresAt,
        createdAt: Date.now(),
        viewCount: 0,
      }
      setGeneratedShare(share)
      setActiveShares((prev) => [...prev, share])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate share link')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRevoke = useCallback(
    async (token: string) => {
      try {
        const response = await fetch(`/api/sessions/${sessionId}/share?token=${token}`, {
          method: 'DELETE',
        })
        if (response.ok) {
          setActiveShares((prev) => prev.filter((s) => s.token !== token))
          if (generatedShare?.token === token) {
            setGeneratedShare(null)
          }
        }
      } catch (err) {
        console.error('Failed to revoke share:', err)
      }
    },
    [sessionId, generatedShare?.token]
  )

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-action="share-session"
          className={css({
            padding: '8px 12px',
            backgroundColor: isDark ? 'purple.700' : 'purple.100',
            color: isDark ? 'purple.200' : 'purple.700',
            border: 'none',
            borderRadius: '6px',
            fontSize: '0.8125rem',
            fontWeight: 'medium',
            cursor: 'pointer',
            _hover: { backgroundColor: isDark ? 'purple.600' : 'purple.200' },
          })}
        >
          🔗 Share
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          data-component="share-popover"
          align="end"
          side="top"
          sideOffset={8}
          collisionPadding={16}
          className={css({
            backgroundColor: isDark ? 'gray.800' : 'white',
            borderRadius: '12px',
            padding: '16px',
            boxShadow: '0 10px 40px rgba(0, 0, 0, 0.2)',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            width: 'min(520px, calc(100vw - 32px))',
            maxHeight: 'calc(100vh - 100px)',
            overflowY: 'auto',
            zIndex: Z_INDEX.DROPDOWN,
          })}
        >
          <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
            <h3
              className={css({
                fontSize: '0.9375rem',
                fontWeight: 'semibold',
                color: isDark ? 'white' : 'gray.900',
                margin: 0,
              })}
            >
              Share Session Link
            </h3>

            {/* Generated link display - horizontal layout */}
            {generatedShare && (
              <div
                data-element="generated-share"
                className={css({
                  backgroundColor: isDark ? 'green.900/40' : 'green.50',
                  padding: '12px',
                  borderRadius: '8px',
                  display: 'flex',
                  gap: '16px',
                  border: '1px solid',
                  borderColor: isDark ? 'green.700' : 'green.200',
                  flexWrap: 'wrap',
                })}
              >
                {/* QR Code - left side */}
                <div
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '8px',
                    flexShrink: 0,
                  })}
                >
                  <div
                    className={css({
                      padding: '8px',
                      bg: 'white',
                      borderRadius: '8px',
                      border: '1px solid',
                      borderColor: isDark ? 'gray.600' : 'gray.200',
                    })}
                  >
                    <AbacusQRCode value={generatedShare.url} size={100} />
                  </div>
                  <div
                    className={css({
                      fontSize: '0.6875rem',
                      color: isDark ? 'green.300' : 'green.600',
                      textAlign: 'center',
                    })}
                  >
                    ⏱️ {formatTimeRemaining(generatedShare.expiresAt)}
                  </div>
                </div>

                {/* Copy buttons - right side */}
                <div
                  className={css({
                    flex: 1,
                    minWidth: '200px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                  })}
                >
                  <div
                    className={css({
                      fontSize: '0.75rem',
                      color: isDark ? 'green.200' : 'green.700',
                      fontWeight: 'medium',
                    })}
                  >
                    ✓ Link created!
                  </div>
                  <CopyButton
                    text={generatedShare.token}
                    label={generatedShare.token}
                    copiedLabel="Token copied!"
                    variant="code"
                  />
                  <CopyButton
                    text={generatedShare.url}
                    label="🔗 Copy link"
                    copiedLabel="Link copied!"
                    variant="link"
                  />
                  <button
                    type="button"
                    onClick={() => setGeneratedShare(null)}
                    className={css({
                      padding: '6px',
                      backgroundColor: 'transparent',
                      color: isDark ? 'gray.400' : 'gray.500',
                      border: '1px dashed',
                      borderColor: isDark ? 'gray.600' : 'gray.300',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      _hover: { borderColor: isDark ? 'gray.500' : 'gray.400' },
                    })}
                  >
                    + Generate another
                  </button>
                </div>
              </div>
            )}

            {/* Expiration selector - compact horizontal */}
            {!generatedShare && (
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  flexWrap: 'wrap',
                })}
              >
                <label
                  className={css({
                    fontSize: '0.8125rem',
                    color: isDark ? 'gray.300' : 'gray.600',
                    whiteSpace: 'nowrap',
                  })}
                >
                  Expires in:
                </label>
                <div className={css({ display: 'flex', gap: '6px' })}>
                  <button
                    type="button"
                    onClick={() => setExpiresIn('1h')}
                    className={css({
                      padding: '6px 12px',
                      fontSize: '0.8125rem',
                      backgroundColor:
                        expiresIn === '1h'
                          ? isDark
                            ? 'purple.600'
                            : 'purple.500'
                          : isDark
                            ? 'gray.700'
                            : 'gray.100',
                      color: expiresIn === '1h' ? 'white' : isDark ? 'gray.300' : 'gray.700',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    })}
                  >
                    1h
                  </button>
                  <button
                    type="button"
                    onClick={() => setExpiresIn('24h')}
                    className={css({
                      padding: '6px 12px',
                      fontSize: '0.8125rem',
                      backgroundColor:
                        expiresIn === '24h'
                          ? isDark
                            ? 'purple.600'
                            : 'purple.500'
                          : isDark
                            ? 'gray.700'
                            : 'gray.100',
                      color: expiresIn === '24h' ? 'white' : isDark ? 'gray.300' : 'gray.700',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                    })}
                  >
                    24h
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating}
                  className={css({
                    padding: '6px 16px',
                    backgroundColor: isDark ? 'purple.600' : 'purple.500',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.8125rem',
                    fontWeight: 'medium',
                    cursor: 'pointer',
                    _hover: { backgroundColor: isDark ? 'purple.500' : 'purple.600' },
                    _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                  })}
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
                {error && (
                  <div className={css({ fontSize: '0.75rem', color: 'red.500', width: '100%' })}>
                    {error}
                  </div>
                )}
              </div>
            )}

            {/* Active shares list - scrollable, compact grid layout */}
            {activeShares.length > 0 && (
              <div
                data-element="active-shares"
                className={css({
                  borderTop: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.200',
                  paddingTop: '12px',
                })}
              >
                <div
                  className={css({
                    fontSize: '0.75rem',
                    color: isDark ? 'gray.400' : 'gray.500',
                    marginBottom: '8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  })}
                >
                  <span>Active Links ({activeShares.length})</span>
                  <span>
                    {activeShares.reduce((sum, s) => sum + (s.viewCount ?? 0), 0)} total views
                  </span>
                </div>
                <div
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                    gap: '8px',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    paddingRight: '4px',
                  })}
                >
                  {activeShares.map((share) => (
                    <div
                      key={share.token}
                      data-element="share-item"
                      className={css({
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        backgroundColor: isDark ? 'gray.700' : 'gray.50',
                        borderRadius: '8px',
                        fontSize: '0.6875rem',
                        gap: '8px',
                      })}
                    >
                      {/* Share info - compact */}
                      <div
                        className={css({
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          minWidth: 0,
                        })}
                      >
                        <span
                          className={css({
                            fontFamily: 'monospace',
                            fontWeight: 'medium',
                            color: isDark ? 'purple.300' : 'purple.600',
                          })}
                        >
                          ...{share.token.slice(-6)}
                        </span>
                        <div
                          className={css({
                            display: 'flex',
                            gap: '8px',
                            color: isDark ? 'gray.400' : 'gray.500',
                            flexWrap: 'wrap',
                          })}
                        >
                          <span>⏱️ {formatTimeRemaining(share.expiresAt)}</span>
                          <span>👁️ {share.viewCount ?? 0}</span>
                        </div>
                      </div>

                      {/* Actions - inline */}
                      <div className={css({ display: 'flex', gap: '4px', flexShrink: 0 })}>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(share.url)}
                          title="Copy link"
                          className={css({
                            padding: '4px 6px',
                            backgroundColor: 'transparent',
                            color: isDark ? 'gray.300' : 'gray.600',
                            border: '1px solid',
                            borderColor: isDark ? 'gray.600' : 'gray.300',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.625rem',
                            _hover: {
                              backgroundColor: isDark ? 'gray.600' : 'gray.200',
                            },
                          })}
                        >
                          📋
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRevoke(share.token)}
                          title="Revoke"
                          className={css({
                            padding: '4px 6px',
                            backgroundColor: 'transparent',
                            color: 'red.500',
                            border: '1px solid',
                            borderColor: isDark ? 'red.800' : 'red.200',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '0.625rem',
                            _hover: {
                              backgroundColor: isDark ? 'red.900/50' : 'red.50',
                            },
                          })}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <Popover.Arrow
            className={css({
              fill: isDark ? 'gray.800' : 'white',
            })}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
