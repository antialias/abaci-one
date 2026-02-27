'use client'

import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { SeedStudentsSection } from '@/components/debug/SeedStudentsSection'
import { StartPracticeModal } from '@/components/practice/StartPracticeModal'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import {
  useCleanupPreview,
  useCleanupDebugPlayers,
  useCreateDebugPracticeSession,
} from '@/hooks/useDebugSeedStudents'
import { useSessionMode } from '@/hooks/useSessionMode'
import { css } from '../../../../styled-system/css'

interface Preset {
  id: string
  label: string
  description: string
}

const PRESETS: Preset[] = [
  {
    id: 'game-break',
    label: 'Game Break Test',
    description: '2 parts (1 problem each) with auto-start matching game break between them',
  },
  {
    id: 'minimal',
    label: 'Minimal Session',
    description: '1 part, 1 problem, no game break — fastest possible session',
  },
]

function CleanupSection({ isDark }: { isDark: boolean }) {
  const [showPreview, setShowPreview] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [lastResult, setLastResult] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)
  const preview = useCleanupPreview(showPreview)
  const cleanup = useCleanupDebugPlayers()

  const handleDelete = () => {
    cleanup.mutate(undefined, {
      onSuccess: (data) => {
        setConfirming(false)
        setShowPreview(false)
        setLastResult({
          type: 'success',
          message: `Deleted ${data.deleted} player${data.deleted !== 1 ? 's' : ''} and all related data.`,
        })
      },
      onError: (err) => {
        setLastResult({
          type: 'error',
          message: err.message,
        })
      },
    })
  }

  return (
    <section
      data-component="cleanup-section"
      className={css({ marginTop: '2rem' })}
    >
      <h2
        className={css({
          fontSize: '1.25rem',
          fontWeight: '600',
          color: isDark ? 'white' : 'gray.800',
          marginBottom: '0.75rem',
        })}
      >
        Cleanup
      </h2>
      <p
        className={css({
          fontSize: '0.875rem',
          color: isDark ? 'gray.400' : 'gray.600',
          marginBottom: '1rem',
        })}
      >
        Remove debug, seed, and e2e test players. Matches Debug-* naming, seed entries, and * Test
        Child naming. Your real student profiles are safe.
      </p>

      {lastResult && !showPreview && (
        <div
          data-element={`cleanup-${lastResult.type}`}
          className={css({
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '1rem',
            fontSize: '0.875rem',
            border: '1px solid',
            ...(lastResult.type === 'success'
              ? {
                  backgroundColor: isDark ? 'green.900/30' : 'green.50',
                  color: isDark ? 'green.300' : 'green.700',
                  borderColor: isDark ? 'green.800' : 'green.200',
                }
              : {
                  backgroundColor: isDark ? 'red.900/30' : 'red.50',
                  color: isDark ? 'red.300' : 'red.700',
                  borderColor: isDark ? 'red.800' : 'red.200',
                }),
          })}
        >
          {lastResult.message}
        </div>
      )}

      {!showPreview && (
        <button
          data-action="preview-cleanup"
          onClick={() => {
            setLastResult(null)
            setShowPreview(true)
          }}
          className={css({
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            borderRadius: '8px',
            border: '1px solid',
            borderColor: isDark ? 'gray.600' : 'gray.300',
            backgroundColor: isDark ? 'gray.800' : 'white',
            color: isDark ? 'gray.200' : 'gray.700',
            fontSize: '0.875rem',
            fontWeight: '500',
            cursor: 'pointer',
            _hover: {
              backgroundColor: isDark ? 'gray.700' : 'gray.50',
            },
          })}
        >
          <Trash2 size={14} />
          Scan for debug players
        </button>
      )}

      {showPreview && preview.isLoading && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '1rem',
            fontSize: '0.875rem',
            color: isDark ? 'gray.400' : 'gray.500',
          })}
        >
          <Loader2
            size={16}
            className={css({ animation: 'spin 1s linear infinite' })}
          />
          Scanning...
        </div>
      )}

      {showPreview && preview.data && (
        <div
          data-element="cleanup-preview"
          className={css({
            backgroundColor: isDark ? 'gray.800' : 'white',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
            borderRadius: '12px',
            overflow: 'hidden',
          })}
        >
          {preview.data.count === 0 ? (
            <div
              className={css({
                padding: '1rem 1.25rem',
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
              })}
            >
              No debug or seed players found.
            </div>
          ) : (
            <>
              <div
                className={css({
                  padding: '0.75rem 1.25rem',
                  borderBottom: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.100',
                  fontSize: '0.875rem',
                  fontWeight: '600',
                  color: isDark ? 'gray.200' : 'gray.700',
                })}
              >
                {preview.data.count} player{preview.data.count !== 1 ? 's' : ''} will be deleted
              </div>
              <ul
                className={css({
                  listStyle: 'none',
                  padding: 0,
                  margin: 0,
                  maxHeight: '240px',
                  overflowY: 'auto',
                })}
              >
                {preview.data.players.map((p) => (
                  <li
                    key={p.id}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.5rem 1.25rem',
                      borderBottom: '1px solid',
                      borderColor: isDark ? 'gray.700/50' : 'gray.50',
                      fontSize: '0.875rem',
                    })}
                  >
                    <span>{p.emoji}</span>
                    <span className={css({ color: isDark ? 'gray.200' : 'gray.700', flex: 1 })}>
                      {p.name}
                    </span>
                    <span
                      className={css({
                        fontSize: '0.75rem',
                        color: isDark ? 'gray.500' : 'gray.400',
                        fontFamily: 'monospace',
                      })}
                    >
                      {p.source}
                    </span>
                  </li>
                ))}
              </ul>
              <div
                className={css({
                  display: 'flex',
                  gap: '0.5rem',
                  padding: '0.75rem 1.25rem',
                  borderTop: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.100',
                })}
              >
                {!confirming ? (
                  <>
                    <button
                      data-action="confirm-cleanup"
                      onClick={() => setConfirming(true)}
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '6px',
                        border: 'none',
                        backgroundColor: 'red.600',
                        color: 'white',
                        fontSize: '0.8125rem',
                        fontWeight: '500',
                        cursor: 'pointer',
                        _hover: { backgroundColor: 'red.700' },
                      })}
                    >
                      <Trash2 size={13} />
                      Delete all
                    </button>
                    <button
                      data-action="cancel-cleanup"
                      onClick={() => setShowPreview(false)}
                      className={css({
                        padding: '0.375rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isDark ? 'gray.600' : 'gray.300',
                        backgroundColor: 'transparent',
                        color: isDark ? 'gray.300' : 'gray.600',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        _hover: {
                          backgroundColor: isDark ? 'gray.700' : 'gray.50',
                        },
                      })}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      data-action="execute-cleanup"
                      onClick={handleDelete}
                      disabled={cleanup.isPending}
                      className={css({
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.375rem 0.75rem',
                        borderRadius: '6px',
                        border: '2px solid',
                        borderColor: 'red.600',
                        backgroundColor: isDark ? 'red.900/40' : 'red.50',
                        color: isDark ? 'red.300' : 'red.700',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        cursor: cleanup.isPending ? 'wait' : 'pointer',
                        _hover: {
                          backgroundColor: isDark ? 'red.900/60' : 'red.100',
                        },
                      })}
                    >
                      {cleanup.isPending ? (
                        <Loader2
                          size={13}
                          className={css({ animation: 'spin 1s linear infinite' })}
                        />
                      ) : (
                        <Trash2 size={13} />
                      )}
                      Yes, delete {preview.data.count} player{preview.data.count !== 1 ? 's' : ''}
                    </button>
                    <button
                      data-action="cancel-confirm"
                      onClick={() => setConfirming(false)}
                      disabled={cleanup.isPending}
                      className={css({
                        padding: '0.375rem 0.75rem',
                        borderRadius: '6px',
                        border: '1px solid',
                        borderColor: isDark ? 'gray.600' : 'gray.300',
                        backgroundColor: 'transparent',
                        color: isDark ? 'gray.300' : 'gray.600',
                        fontSize: '0.8125rem',
                        cursor: 'pointer',
                        _hover: {
                          backgroundColor: isDark ? 'gray.700' : 'gray.50',
                        },
                      })}
                    >
                      Back
                    </button>
                  </>
                )}
              </div>
            </>
          )}

        </div>
      )}
    </section>
  )
}

export default function DebugPracticePage() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [useModal, setUseModal] = useState(true)
  const createSession = useCreateDebugPracticeSession()

  // State for modal flow: stores the debug player created by setupOnly API call
  const [debugPlayer, setDebugPlayer] = useState<{
    id: string
    name: string
  } | null>(null)

  // Fetch session mode for the debug player (only enabled when we have one)
  const { data: sessionModeData, isLoading: sessionModeLoading } = useSessionMode(
    debugPlayer?.id ?? '',
    !!debugPlayer
  )

  // Track which preset is loading (mutation is shared across presets)
  const [activePreset, setActivePreset] = useState<string | null>(null)

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset.id)
    createSession.reset()

    createSession.mutate(
      { preset: preset.id, setupOnly: useModal },
      {
        onSuccess: (data) => {
          if (data.setupOnly) {
            setDebugPlayer({ id: data.playerId!, name: data.playerName! })
          } else {
            router.push(data.redirectUrl!)
          }
        },
        onSettled: () => {
          if (!useModal) setActivePreset(null)
        },
      }
    )
  }

  const showModal = !!debugPlayer && !!sessionModeData && !sessionModeLoading
  const loading =
    activePreset && (createSession.isPending || (useModal && !showModal && !createSession.error))
      ? activePreset
      : null
  const error = createSession.error?.message ?? null

  return (
    <PageWithNav>
      <main
        data-component="debug-practice"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          padding: '2rem',
        })}
      >
        <div className={css({ maxWidth: '600px', margin: '0 auto' })}>
          <header className={css({ marginBottom: '2rem' })}>
            <Link
              href="/debug"
              data-action="back-to-debug-hub"
              className={css({
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: '0.875rem',
                color: isDark ? 'gray.400' : 'gray.500',
                textDecoration: 'none',
                marginBottom: '0.75rem',
                _hover: { color: isDark ? 'gray.200' : 'gray.700' },
              })}
            >
              <ArrowLeft size={14} />
              Debug Hub
            </Link>
            <h1
              className={css({
                fontSize: '1.75rem',
                fontWeight: 'bold',
                color: isDark ? 'white' : 'gray.800',
                marginBottom: '0.5rem',
              })}
            >
              Practice Debug
            </h1>
            <p className={css({ color: isDark ? 'gray.400' : 'gray.600' })}>
              Create debug sessions with presets. Each creates a fresh debug player with basic
              skills.
            </p>
          </header>

          {error && (
            <div
              data-element="error-banner"
              className={css({
                padding: '12px 16px',
                backgroundColor: isDark ? 'red.900/30' : 'red.50',
                color: isDark ? 'red.300' : 'red.700',
                borderRadius: '8px',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                border: '1px solid',
                borderColor: isDark ? 'red.800' : 'red.200',
              })}
            >
              {error}
            </div>
          )}

          <div className={css({ display: 'flex', flexDirection: 'column', gap: '12px' })}>
            {PRESETS.map((preset) => {
              const isLoading = loading === preset.id && !(useModal && showModal)
              return (
                <div
                  key={preset.id}
                  className={css({
                    backgroundColor: isDark ? 'gray.800' : 'white',
                    border: '1px solid',
                    borderColor: isDark ? 'gray.700' : 'gray.200',
                    borderRadius: '12px',
                    overflow: 'hidden',
                    opacity: loading !== null && loading !== preset.id ? 0.5 : 1,
                    transition: 'all 0.2s',
                  })}
                >
                  <button
                    data-action={`preset-${preset.id}`}
                    onClick={() => handlePreset(preset)}
                    disabled={loading !== null}
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      width: '100%',
                      padding: '1rem 1.25rem',
                      backgroundColor: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      cursor: loading !== null ? 'wait' : 'pointer',
                      transition: 'background-color 0.2s',
                      _hover: {
                        backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                      },
                    })}
                  >
                    <div className={css({ flex: 1 })}>
                      <div
                        className={css({
                          fontWeight: '600',
                          color: isDark ? 'white' : 'gray.800',
                          marginBottom: '4px',
                        })}
                      >
                        {preset.label}
                      </div>
                      <div
                        className={css({
                          fontSize: '0.875rem',
                          color: isDark ? 'gray.400' : 'gray.600',
                        })}
                      >
                        {preset.description}
                      </div>
                    </div>
                    {isLoading && (
                      <Loader2
                        size={20}
                        className={css({
                          animation: 'spin 1s linear infinite',
                          color: isDark ? 'gray.400' : 'gray.500',
                        })}
                      />
                    )}
                  </button>
                  <label
                    data-element="use-modal-toggle"
                    className={css({
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.375rem',
                      padding: '0.5rem 1.25rem',
                      borderTop: '1px solid',
                      borderColor: isDark ? 'gray.700/50' : 'gray.100',
                      fontSize: '0.75rem',
                      color: isDark ? 'gray.500' : 'gray.400',
                      cursor: 'pointer',
                      userSelect: 'none',
                      _hover: {
                        color: isDark ? 'gray.300' : 'gray.600',
                      },
                    })}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={useModal}
                      onChange={(e) => setUseModal(e.target.checked)}
                      className={css({ cursor: 'pointer' })}
                    />
                    Show start practice modal
                  </label>
                </div>
              )
            })}
          </div>

          <SeedStudentsSection isDark={isDark} />

          <CleanupSection isDark={isDark} />
        </div>
      </main>

      {showModal && (
        <StartPracticeModal
          studentId={debugPlayer.id}
          studentName={debugPlayer.name}
          focusDescription={sessionModeData.sessionMode.focusDescription}
          sessionMode={sessionModeData.sessionMode}
          comfortLevel={sessionModeData.comfortLevel}
          comfortByMode={sessionModeData.comfortByMode}
          onClose={() => {
            setDebugPlayer(null)
            setActivePreset(null)
          }}
          onStarted={() => {
            setDebugPlayer(null)
            setActivePreset(null)
          }}
        />
      )}
    </PageWithNav>
  )
}
