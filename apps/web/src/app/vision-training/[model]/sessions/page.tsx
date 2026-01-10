'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { css } from '../../../../../styled-system/css'
import { useModelType } from '../../hooks/useModelType'
import { getModelEntry } from '../../registry'

interface SessionSummary {
  id: string
  modelType: 'column-classifier' | 'boundary-detector'
  displayName: string
  finalAccuracy: number
  finalPixelError?: number
  epochsTrained: number
  isActive: boolean
  trainedAt: number
}

/**
 * Sessions List Page
 *
 * Located at /vision-training/[model]/sessions
 * Shows training sessions filtered by the model type from the URL.
 */
export default function SessionsPage() {
  const modelType = useModelType()
  const modelEntry = getModelEntry(modelType)

  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('modelType', modelType)
      const response = await fetch(`/api/vision/sessions?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch sessions')
      }
      const data = await response.json()
      setSessions(data.sessions)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [modelType])

  useEffect(() => {
    fetchSessions()
  }, [fetchSessions])

  const handleActivate = async (sessionId: string) => {
    setActivating(sessionId)
    try {
      const response = await fetch(`/api/vision/sessions/${sessionId}/activate`, {
        method: 'PUT',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to activate')
      }
      // Refresh the list
      await fetchSessions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to activate model')
    } finally {
      setActivating(null)
    }
  }

  const handleDelete = async (sessionId: string, displayName: string) => {
    if (!confirm(`Delete "${displayName}"? This will also delete the model files.`)) {
      return
    }
    setDeleting(sessionId)
    try {
      const response = await fetch(`/api/vision/sessions/${sessionId}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete')
      }
      // Refresh the list
      await fetchSessions()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete session')
    } finally {
      setDeleting(null)
    }
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div
      data-component="sessions-page"
      className={css({
        minHeight: 'calc(100vh - var(--nav-height))',
        bg: 'gray.900',
        color: 'gray.100',
      })}
    >
      {/* Page header */}
      <div
        className={css({
          p: 4,
          borderBottom: '1px solid',
          borderColor: 'gray.800',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        })}
      >
        <div>
          <h1 className={css({ fontSize: 'xl', fontWeight: 'bold' })}>
            {modelEntry.label} Sessions
          </h1>
          <p className={css({ fontSize: 'sm', color: 'gray.400', mt: 1 })}>
            View and manage training sessions for {modelEntry.label}
          </p>
        </div>
        <Link
          href={`/vision-training/${modelType}/train`}
          className={css({
            px: 4,
            py: 2,
            bg: 'green.600',
            color: 'white',
            borderRadius: 'lg',
            textDecoration: 'none',
            fontWeight: 'medium',
            fontSize: 'sm',
            _hover: { bg: 'green.500' },
          })}
        >
          + Train New Model
        </Link>
      </div>

      {/* Sessions list */}
      <main className={css({ p: 4 })}>
        {loading && (
          <div className={css({ textAlign: 'center', py: 8, color: 'gray.400' })}>
            Loading sessions...
          </div>
        )}

        {error && (
          <div
            className={css({
              textAlign: 'center',
              py: 8,
              color: 'red.400',
            })}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && sessions.length === 0 && (
          <div
            className={css({
              textAlign: 'center',
              py: 8,
              color: 'gray.400',
            })}
          >
            <div className={css({ fontSize: '3xl', mb: 2 })}>No sessions yet</div>
            <div>No training sessions found for {modelEntry.label}</div>
            <Link
              href={`/vision-training/${modelType}/train`}
              className={css({
                display: 'inline-block',
                mt: 4,
                px: 4,
                py: 2,
                bg: 'blue.600',
                color: 'white',
                borderRadius: 'lg',
                textDecoration: 'none',
                _hover: { bg: 'blue.500' },
              })}
            >
              Train Your First Model
            </Link>
          </div>
        )}

        {!loading && !error && sessions.length > 0 && (
          <div
            className={css({
              display: 'grid',
              gap: 4,
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            })}
          >
            {sessions.map((session) => (
              <div
                key={session.id}
                data-session-id={session.id}
                className={css({
                  p: 4,
                  bg: 'gray.800',
                  borderRadius: 'lg',
                  border: '2px solid',
                  borderColor: session.isActive ? 'green.500' : 'gray.700',
                  position: 'relative',
                })}
              >
                {/* Active badge */}
                {session.isActive && (
                  <div
                    className={css({
                      position: 'absolute',
                      top: 2,
                      right: 2,
                      px: 2,
                      py: 0.5,
                      bg: 'green.600',
                      color: 'white',
                      fontSize: 'xs',
                      fontWeight: 'bold',
                      borderRadius: 'md',
                    })}
                  >
                    ACTIVE
                  </div>
                )}

                {/* Title */}
                <Link
                  href={`/vision-training/${modelType}/sessions/${session.id}`}
                  className={css({
                    display: 'block',
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    mb: 2,
                    pr: session.isActive ? 16 : 0,
                    color: 'gray.100',
                    textDecoration: 'none',
                    _hover: { color: 'blue.400' },
                  })}
                >
                  {session.displayName}
                </Link>

                {/* Metrics */}
                <div
                  className={css({
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 2,
                    mb: 4,
                  })}
                >
                  <div>
                    <div className={css({ fontSize: 'xs', color: 'gray.500' })}>
                      {modelType === 'boundary-detector' ? 'Pixel Error' : 'Accuracy'}
                    </div>
                    <div
                      className={css({
                        fontSize: 'lg',
                        fontWeight: 'bold',
                        color: modelType === 'boundary-detector' ? 'orange.400' : 'green.400',
                      })}
                    >
                      {modelType === 'boundary-detector' && session.finalPixelError !== undefined
                        ? `${session.finalPixelError.toFixed(1)}px`
                        : `${(session.finalAccuracy * 100).toFixed(1)}%`}
                    </div>
                  </div>
                  <div>
                    <div className={css({ fontSize: 'xs', color: 'gray.500' })}>Epochs</div>
                    <div className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'gray.300' })}>
                      {session.epochsTrained}
                    </div>
                  </div>
                </div>

                {/* Date */}
                <div className={css({ fontSize: 'xs', color: 'gray.500', mb: 4 })}>
                  Trained: {formatDate(session.trainedAt)}
                </div>

                {/* Actions */}
                <div
                  className={css({
                    display: 'flex',
                    gap: 2,
                    borderTop: '1px solid',
                    borderColor: 'gray.700',
                    pt: 3,
                    mt: 3,
                  })}
                >
                  {!session.isActive && (
                    <button
                      type="button"
                      onClick={() => handleActivate(session.id)}
                      disabled={activating === session.id}
                      className={css({
                        flex: 1,
                        py: 2,
                        bg: 'green.600',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        fontWeight: 'medium',
                        fontSize: 'sm',
                        _hover: { bg: 'green.500' },
                        _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                      })}
                    >
                      {activating === session.id ? 'Activating...' : 'Set Active'}
                    </button>
                  )}
                  <Link
                    href={`/vision-training/${modelType}/test?session=${session.id}`}
                    className={css({
                      flex: 1,
                      py: 2,
                      bg: 'blue.600',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'md',
                      textDecoration: 'none',
                      textAlign: 'center',
                      fontWeight: 'medium',
                      fontSize: 'sm',
                      _hover: { bg: 'blue.500' },
                    })}
                  >
                    Test
                  </Link>
                  {!session.isActive && (
                    <button
                      type="button"
                      onClick={() => handleDelete(session.id, session.displayName)}
                      disabled={deleting === session.id}
                      className={css({
                        py: 2,
                        px: 3,
                        bg: 'red.900/50',
                        color: 'red.400',
                        border: '1px solid',
                        borderColor: 'red.800',
                        borderRadius: 'md',
                        cursor: 'pointer',
                        fontWeight: 'medium',
                        fontSize: 'sm',
                        _hover: { bg: 'red.900' },
                        _disabled: { opacity: 0.5, cursor: 'not-allowed' },
                      })}
                    >
                      {deleting === session.id ? '...' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
