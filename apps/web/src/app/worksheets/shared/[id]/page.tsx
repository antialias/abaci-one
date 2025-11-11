'use client'

import { css } from '@styled/css'
import { stack } from '@styled/patterns'
import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels'
import { ConfigSidebar } from '@/app/create/worksheets/components/ConfigSidebar'
import { PreviewCenter } from '@/app/create/worksheets/components/PreviewCenter'
import { WorksheetConfigProvider } from '@/app/create/worksheets/components/WorksheetConfigContext'
import type { WorksheetFormState } from '@/app/create/worksheets/types'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'

interface ShareData {
  id: string
  worksheetType: string
  config: WorksheetFormState
  createdAt: string
  views: number
  title: string | null
}

export default function SharedWorksheetPage() {
  const params = useParams()
  const router = useRouter()
  const shareId = params.id as string
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [shareData, setShareData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [previewError, setPreviewError] = useState<{ error: string; details?: string } | null>(null)
  const [preview, setPreview] = useState<string[] | undefined>(undefined)
  const [showEditModal, setShowEditModal] = useState(false)

  // Fetch shared worksheet data
  useEffect(() => {
    const fetchShare = async () => {
      try {
        const response = await fetch(`/api/worksheets/share/${shareId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Shared worksheet not found')
          } else {
            setError('Failed to load shared worksheet')
          }
          return
        }

        const data = await response.json()
        setShareData(data)

        // Fetch preview from API
        try {
          const previewResponse = await fetch('/api/worksheets/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ config: data.config }),
          })

          if (previewResponse.ok) {
            const previewData = await previewResponse.json()
            if (previewData.success) {
              setPreview(previewData.pages)
            } else {
              // Preview generation failed - store error details
              setPreviewError({
                error: previewData.error || 'Failed to generate preview',
                details: previewData.details,
              })
            }
          } else {
            setPreviewError({
              error: 'Preview generation failed',
              details: `HTTP ${previewResponse.status}: ${previewResponse.statusText}`,
            })
          }
        } catch (err) {
          console.error('Failed to generate preview:', err)
          setPreviewError({
            error: 'Failed to generate preview',
            details: err instanceof Error ? err.message : String(err),
          })
        }
      } catch (err) {
        console.error('Error fetching shared worksheet:', err)
        setError('Failed to load shared worksheet')
      } finally {
        setLoading(false)
      }
    }

    fetchShare()
  }, [shareId])

  const handleOpenInEditor = async () => {
    if (!shareData) return

    // Save shared config to user's session (overwrites current settings)
    try {
      await fetch('/api/worksheets/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'addition',
          config: shareData.config,
        }),
      })

      // Navigate to editor
      router.push('/create/worksheets')
    } catch (err) {
      console.error('Failed to save config:', err)
      // TODO: Show error toast
    }
  }

  // Resize handle styles
  const resizeHandleStyles = css({
    width: '8px',
    bg: isDark ? 'gray.700' : 'gray.200',
    position: 'relative',
    cursor: 'col-resize',
    transition: 'background 0.2s',
    _hover: {
      bg: isDark ? 'brand.600' : 'brand.400',
    },
    _active: {
      bg: 'brand.500',
    },
    _before: {
      content: '""',
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      width: '3px',
      height: '20px',
      bg: isDark ? 'gray.600' : 'gray.300',
      rounded: 'full',
    },
  })

  if (loading) {
    return (
      <div
        className={css({
          minH: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
        })}
      >
        <div className={stack({ gap: '4', alignItems: 'center' })}>
          <div
            className={css({
              w: '16',
              h: '16',
              border: '4px solid',
              borderColor: 'gray.300',
              borderTopColor: 'brand.600',
              rounded: 'full',
              animation: 'spin 1s linear infinite',
            })}
          />
          <p className={css({ fontSize: 'lg', color: 'gray.600' })}>Loading shared worksheet...</p>
        </div>
      </div>
    )
  }

  if (error || !shareData) {
    return (
      <div
        className={css({
          minH: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          bg: 'gray.50',
          p: '4',
        })}
      >
        <div
          className={css({
            maxW: 'md',
            w: 'full',
            bg: 'white',
            rounded: 'xl',
            shadow: 'xl',
            p: '8',
          })}
        >
          <div className={stack({ gap: '4', alignItems: 'center' })}>
            <div className={css({ fontSize: '4xl' })}>❌</div>
            <h1 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'gray.900' })}>
              {error || 'Not Found'}
            </h1>
            <p className={css({ fontSize: 'md', color: 'gray.600', textAlign: 'center' })}>
              This shared worksheet link may have expired or been removed.
            </p>
            <button
              onClick={() => router.push('/create/worksheets')}
              className={css({
                px: '6',
                py: '3',
                bg: 'brand.600',
                color: 'white',
                fontSize: 'md',
                fontWeight: 'bold',
                rounded: 'lg',
                cursor: 'pointer',
                transition: 'all 0.2s',
                _hover: {
                  bg: 'brand.700',
                },
              })}
            >
              Create Your Own Worksheet
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageWithNav>
      <WorksheetConfigProvider
        formState={shareData.config}
        updateFormState={() => {}} // No-op for read-only
        isReadOnly={true}
      >
        <div
          data-component="shared-worksheet-studio"
          className={css({
            position: 'fixed',
            inset: 0,
            top: '16', // Account for nav bar
            display: 'flex',
            flexDirection: 'column',
            bg: isDark ? 'gray.900' : 'gray.50',
          })}
        >
          {/* Read-only banner */}
          <div
            data-component="shared-mode-banner"
            className={css({
              bg: 'blue.600',
              color: 'white',
              px: '6',
              py: '3',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '4',
              shadow: 'md',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
              <span className={css({ fontSize: 'xl' })}>🔗</span>
              <div>
                <div className={css({ fontWeight: 'bold', fontSize: 'md' })}>
                  Shared Worksheet (Read-Only)
                </div>
                <div className={css({ fontSize: 'sm', opacity: '0.9' })}>
                  {shareData.title || `Shared by someone • ${shareData.views} views`}
                </div>
              </div>
            </div>

            <button
              data-action="open-edit-modal"
              onClick={() => setShowEditModal(true)}
              className={css({
                px: '4',
                py: '2',
                bg: 'white',
                color: 'blue.600',
                fontSize: 'sm',
                fontWeight: 'bold',
                rounded: 'lg',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '2',
                _hover: {
                  bg: 'blue.50',
                  transform: 'translateY(-1px)',
                  shadow: 'md',
                },
              })}
            >
              <span>✏️</span>
              <span>Edit This Worksheet</span>
            </button>
          </div>

          {/* Worksheet studio layout */}
          <PanelGroup direction="horizontal" className={css({ flex: '1', overflow: 'hidden' })}>
            {/* Left sidebar - Config controls (read-only) */}
            <Panel
              defaultSize={25}
              minSize={20}
              maxSize={35}
              className={css({
                overflow: 'auto',
                p: '4',
                bg: isDark ? 'gray.800' : 'white',
                borderRight: '1px solid',
                borderColor: isDark ? 'gray.700' : 'gray.200',
              })}
            >
              <ConfigSidebar isReadOnly={true} />
            </Panel>

            <PanelResizeHandle className={resizeHandleStyles} />

            {/* Center - Preview */}
            <Panel defaultSize={75} minSize={50} className={css({ overflow: 'hidden' })}>
              {previewError ? (
                <div
                  className={css({
                    h: 'full',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: '8',
                    bg: isDark ? 'gray.900' : 'gray.50',
                  })}
                >
                  <div
                    className={css({
                      maxW: '2xl',
                      bg: isDark ? 'gray.800' : 'white',
                      border: '2px solid',
                      borderColor: 'red.500',
                      rounded: 'xl',
                      p: '6',
                      shadow: 'xl',
                    })}
                  >
                    <div className={stack({ gap: '4' })}>
                      <div className={css({ display: 'flex', alignItems: 'center', gap: '3' })}>
                        <span className={css({ fontSize: '3xl' })}>⚠️</span>
                        <h3
                          className={css({
                            fontSize: 'xl',
                            fontWeight: 'bold',
                            color: 'red.600',
                          })}
                        >
                          Preview Generation Failed
                        </h3>
                      </div>

                      <div
                        className={css({
                          p: '4',
                          bg: isDark ? 'gray.900' : 'red.50',
                          rounded: 'lg',
                          border: '1px solid',
                          borderColor: isDark ? 'gray.700' : 'red.200',
                        })}
                      >
                        <div
                          className={css({
                            fontSize: 'md',
                            fontWeight: 'semibold',
                            color: isDark ? 'red.400' : 'red.700',
                            mb: '2',
                          })}
                        >
                          {previewError.error}
                        </div>
                        {previewError.details && (
                          <div
                            className={css({
                              fontSize: 'sm',
                              color: isDark ? 'gray.400' : 'gray.700',
                              fontFamily: 'mono',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            })}
                          >
                            {previewError.details}
                          </div>
                        )}
                      </div>

                      <div
                        className={css({
                          fontSize: 'sm',
                          color: isDark ? 'gray.400' : 'gray.600',
                        })}
                      >
                        <strong>What this means:</strong> This shared worksheet configuration cannot
                        be previewed because it's missing required data. This may happen if the
                        worksheet was shared before certain features were added to the system.
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <PreviewCenter
                  formState={shareData.config}
                  initialPreview={preview}
                  onGenerate={async () => {}} // No-op for read-only
                  status="idle"
                  isReadOnly={true}
                />
              )}
            </Panel>
          </PanelGroup>

          {/* Edit Modal */}
          {showEditModal && (
            <div
              data-component="edit-modal"
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
              onClick={() => setShowEditModal(false)}
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
                  <div>
                    <h2
                      className={css({
                        fontSize: '2xl',
                        fontWeight: 'bold',
                        color: isDark ? 'gray.100' : 'gray.900',
                        mb: '2',
                      })}
                    >
                      Edit This Worksheet?
                    </h2>
                    <p
                      className={css({
                        fontSize: 'md',
                        color: isDark ? 'gray.400' : 'gray.600',
                      })}
                    >
                      Opening this worksheet in the editor will{' '}
                      <strong className={css({ color: isDark ? 'yellow.400' : 'orange.600' })}>
                        overwrite your current worksheet settings
                      </strong>
                      . Your current configuration will be replaced with this shared worksheet's
                      settings.
                    </p>
                  </div>

                  <div
                    className={css({
                      bg: isDark ? 'gray.700' : 'gray.50',
                      p: '4',
                      rounded: 'lg',
                      border: '2px solid',
                      borderColor: isDark ? 'gray.600' : 'gray.200',
                    })}
                  >
                    <div
                      className={css({ fontSize: 'sm', color: isDark ? 'gray.300' : 'gray.700' })}
                    >
                      <strong>💡 Tip:</strong> If you want to keep your current settings, you can:
                      <ul className={css({ mt: '2', ml: '4', listStyle: 'disc' })}>
                        <li>Download your current worksheet first</li>
                        <li>Open this shared worksheet in a different browser/window</li>
                      </ul>
                    </div>
                  </div>

                  <div
                    className={css({
                      display: 'flex',
                      gap: '3',
                      flexDirection: 'row-reverse',
                    })}
                  >
                    <button
                      data-action="confirm-edit"
                      onClick={handleOpenInEditor}
                      className={css({
                        px: '6',
                        py: '3',
                        bg: 'brand.600',
                        color: 'white',
                        fontSize: 'md',
                        fontWeight: 'bold',
                        rounded: 'lg',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        _hover: {
                          bg: 'brand.700',
                        },
                      })}
                    >
                      Replace My Settings & Edit
                    </button>
                    <button
                      data-action="cancel-edit"
                      onClick={() => setShowEditModal(false)}
                      className={css({
                        px: '6',
                        py: '3',
                        bg: isDark ? 'gray.700' : 'gray.200',
                        color: isDark ? 'gray.300' : 'gray.700',
                        fontSize: 'md',
                        fontWeight: 'medium',
                        rounded: 'lg',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        _hover: {
                          bg: isDark ? 'gray.600' : 'gray.300',
                        },
                      })}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </WorksheetConfigProvider>
    </PageWithNav>
  )
}
