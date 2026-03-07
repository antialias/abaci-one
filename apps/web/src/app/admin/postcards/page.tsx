'use client'

/**
 * Admin Postcards Monitor
 *
 * Observability into postcard generation pipeline: status, task trees,
 * review results, and retry controls.
 */

import { useEffect, useState, useCallback } from 'react'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'

// ── Types ──

interface MomentSnapshot {
  viewport: { center: number; pixelsPerUnit: number }
  highlights?: number[]
  indicatorRange?: { from: number; to: number }
  timestamp: number
  gameTarget?: { value: number; emoji: string }
  demoProgress?: number
}

interface RankedMoment {
  rank: number
  caption: string
  category: string
  snapshot: MomentSnapshot
  transcriptExcerpt: string
}

interface PostcardManifest {
  callerNumber: number
  callerPersonality: string
  childName: string
  childEmoji: string
  moments: RankedMoment[]
  sessionSummary: string
}

interface TaskInfo {
  id: string
  type: string
  status: string
  progress: number | null
  progressMessage: string | null
  error: string | null
  output: unknown
  createdAt: string
  startedAt: string | null
  completedAt: string | null
  parentTaskId?: string | null
}

interface Postcard {
  id: string
  userId: string
  playerId: string | null
  callerNumber: number
  sessionId: string | null
  status: string
  manifest: PostcardManifest
  imageUrl: string | null
  thumbnailUrl: string | null
  isRead: boolean
  taskId: string | null
  createdAt: string
  updatedAt: string | null
  parentTask: TaskInfo | null
  childTasks: TaskInfo[]
}

// ── Component ──

export default function AdminPostcardsPage() {
  const [postcards, setPostcards] = useState<Postcard[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [retrying, setRetrying] = useState<string | null>(null)

  const fetchPostcards = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const response = await fetch(`/api/admin/postcards?${params}`)
      if (!response.ok) throw new Error('Failed to fetch postcards')
      const data = await response.json()
      setPostcards(data.postcards)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  // Poll every 5 seconds
  useEffect(() => {
    fetchPostcards()
    const interval = setInterval(fetchPostcards, 5000)
    return () => clearInterval(interval)
  }, [fetchPostcards])

  const handleRetry = async (postcardId: string) => {
    setRetrying(postcardId)
    try {
      const res = await fetch(`/api/postcards/${postcardId}/retry`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        alert(`Retry failed: ${data.error || res.statusText}`)
      } else {
        // Refresh immediately
        await fetchPostcards()
      }
    } catch (err) {
      alert(`Retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setRetrying(null)
    }
  }

  const selected = selectedId ? (postcards.find((p) => p.id === selectedId) ?? null) : null

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return '#e6a817'
      case 'generating':
      case 'running':
        return '#2196F3'
      case 'ready':
      case 'completed':
        return '#4CAF50'
      case 'failed':
        return '#f44336'
      default:
        return '#888'
    }
  }

  const formatTime = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleString()
  }

  const formatDuration = (start: string | null, end: string | null) => {
    if (!start) return '-'
    const ms = (end ? new Date(end) : new Date()).getTime() - new Date(start).getTime()
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s`
  }

  const headerHeight = 56 + 54

  if (loading) {
    return (
      <div className={css({ minHeight: '100vh', backgroundColor: '#1a1a2e', color: '#eee' })}>
        <AppNavBar />
        <div className={css({ paddingTop: '56px' })}>
          <AdminNav />
        </div>
        <div className={css({ padding: '24px', fontFamily: 'monospace' })}>
          Loading postcards...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={css({ minHeight: '100vh', backgroundColor: '#1a1a2e', color: '#eee' })}>
        <AppNavBar />
        <div className={css({ paddingTop: '56px' })}>
          <AdminNav />
        </div>
        <div className={css({ padding: '24px', fontFamily: 'monospace', color: '#f44336' })}>
          Error: {error}
        </div>
      </div>
    )
  }

  return (
    <div className={css({ minHeight: '100vh', backgroundColor: '#1a1a2e', color: '#eee' })}>
      <AppNavBar />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <div
        className={css({
          display: 'flex',
          height: `calc(100vh - ${headerHeight}px)`,
          fontFamily: 'monospace',
          fontSize: '13px',
        })}
      >
        {/* Left Panel - Postcard List */}
        <div
          className={css({
            width: '420px',
            minWidth: '420px',
            borderRight: '1px solid #333',
            overflow: 'auto',
          })}
        >
          {/* Header */}
          <div
            className={css({
              padding: '12px 16px',
              borderBottom: '1px solid #333',
              backgroundColor: '#16213e',
            })}
          >
            <div className={css({ fontWeight: 'bold', fontSize: '14px' })}>
              Postcards ({postcards.length})
            </div>
            <div className={css({ fontSize: '11px', color: '#8b949e', marginTop: '4px' })}>
              Number line session postcards
            </div>

            {/* Status Filter */}
            <div className={css({ marginTop: '8px' })}>
              <select
                data-element="status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className={css({
                  backgroundColor: '#0d1117',
                  color: '#eee',
                  border: '1px solid #333',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  fontSize: '11px',
                  width: '100%',
                })}
              >
                <option value="">All statuses</option>
                <option value="pending">Pending</option>
                <option value="generating">Generating</option>
                <option value="ready">Ready</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* List */}
          {postcards.length === 0 ? (
            <div className={css({ padding: '16px', color: '#888' })}>No postcards found</div>
          ) : (
            postcards.map((pc) => (
              <div
                key={pc.id}
                data-element="postcard-item"
                onClick={() => setSelectedId(pc.id)}
                className={css({
                  padding: '12px 16px',
                  borderBottom: '1px solid #2a2a4a',
                  cursor: 'pointer',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  backgroundColor: selectedId === pc.id ? '#2a2a5a' : 'transparent',
                  '&:hover': { backgroundColor: '#2a2a4a' },
                })}
              >
                {/* Thumbnail */}
                <div
                  className={css({
                    width: '48px',
                    height: '48px',
                    borderRadius: '6px',
                    overflow: 'hidden',
                    backgroundColor: '#0d1117',
                    flexShrink: 0,
                  })}
                >
                  {pc.thumbnailUrl ? (
                    <img
                      src={pc.thumbnailUrl}
                      alt="Postcard thumbnail"
                      className={css({
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      })}
                    />
                  ) : (
                    <div
                      className={css({
                        width: '100%',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        color: '#444',
                      })}
                    >
                      {pc.manifest?.childEmoji || '?'}
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className={css({ flex: 1, minWidth: 0 })}>
                  <div
                    className={css({
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px',
                    })}
                  >
                    <span className={css({ fontWeight: 'bold' })}>
                      Caller #{pc.callerNumber}
                      {pc.manifest?.childName ? ` - ${pc.manifest.childName}` : ''}
                    </span>
                    <span
                      className={css({
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        backgroundColor: getStatusColor(pc.status),
                        color: 'white',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      })}
                    >
                      {pc.status}
                    </span>
                  </div>
                  <div className={css({ fontSize: '11px', color: '#666' })}>
                    {formatTime(pc.createdAt)}
                  </div>
                  {pc.parentTask &&
                    (pc.parentTask.status === 'running' || pc.parentTask.status === 'pending') && (
                      <div className={css({ marginTop: '4px' })}>
                        <div
                          className={css({
                            height: '3px',
                            backgroundColor: '#333',
                            borderRadius: '2px',
                            overflow: 'hidden',
                          })}
                        >
                          <div
                            className={css({
                              height: '100%',
                              backgroundColor: '#2196F3',
                              transition: 'width 0.3s',
                            })}
                            style={{ width: `${pc.parentTask.progress ?? 0}%` }}
                          />
                        </div>
                        <div className={css({ fontSize: '10px', color: '#888', marginTop: '2px' })}>
                          {pc.parentTask.progressMessage || 'Working...'}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Right Panel - Detail View */}
        <div className={css({ flex: 1, overflow: 'auto' })}>
          {selected ? (
            <div className={css({ padding: '16px' })}>
              {/* Header with retry button */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '16px',
                })}
              >
                <h2 className={css({ fontSize: '18px', margin: 0 })}>
                  Postcard: Caller #{selected.callerNumber}
                </h2>
                {(selected.status === 'failed' || selected.status === 'pending') && (
                  <button
                    data-action="retry-postcard"
                    disabled={retrying === selected.id}
                    onClick={() => handleRetry(selected.id)}
                    className={css({
                      padding: '6px 16px',
                      backgroundColor: '#f44336',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      opacity: retrying === selected.id ? 0.6 : 1,
                      '&:hover': { backgroundColor: '#d32f2f' },
                    })}
                  >
                    {retrying === selected.id ? 'Retrying...' : 'Retry Generation'}
                  </button>
                )}
              </div>

              {/* Image Preview */}
              {selected.imageUrl && (
                <div
                  className={css({
                    marginBottom: '16px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    backgroundColor: '#0d1117',
                    maxWidth: '600px',
                  })}
                >
                  <img
                    src={selected.imageUrl}
                    alt="Postcard image"
                    className={css({ width: '100%', display: 'block' })}
                  />
                </div>
              )}

              {/* Postcard Info */}
              <div
                className={css({
                  marginBottom: '16px',
                  backgroundColor: '#0d1117',
                  borderRadius: '8px',
                  padding: '12px',
                })}
              >
                <h3 className={css({ fontSize: '13px', marginBottom: '8px', color: '#58a6ff' })}>
                  Postcard Info
                </h3>
                <table className={css({ width: '100%', borderCollapse: 'collapse' })}>
                  <tbody>
                    {[
                      ['ID', selected.id],
                      ['Status', selected.status],
                      ['Caller #', String(selected.callerNumber)],
                      ['Child Name', selected.manifest?.childName || '-'],
                      ['Child Emoji', selected.manifest?.childEmoji || '-'],
                      ['Personality', selected.manifest?.callerPersonality || '-'],
                      ['Session ID', selected.sessionId || '-'],
                      ['User ID', selected.userId],
                      ['Player ID', selected.playerId || '-'],
                      ['Is Read', selected.isRead ? 'Yes' : 'No'],
                      ['Created', formatTime(selected.createdAt)],
                      ['Updated', formatTime(selected.updatedAt)],
                    ].map(([label, value]) => (
                      <tr key={label}>
                        <td
                          className={css({
                            padding: '3px 8px',
                            color: '#888',
                            width: '120px',
                            verticalAlign: 'top',
                          })}
                        >
                          {label}
                        </td>
                        <td
                          className={css({
                            padding: '3px 8px',
                            wordBreak: 'break-all',
                          })}
                        >
                          {label === 'Status' ? (
                            <span
                              className={css({
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                backgroundColor: getStatusColor(value),
                                color: 'white',
                              })}
                            >
                              {value}
                            </span>
                          ) : (
                            value
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Session Summary */}
              {selected.manifest?.sessionSummary && (
                <div
                  className={css({
                    marginBottom: '16px',
                    backgroundColor: '#0d1117',
                    borderRadius: '8px',
                    padding: '12px',
                  })}
                >
                  <h3 className={css({ fontSize: '13px', marginBottom: '8px', color: '#58a6ff' })}>
                    Session Summary
                  </h3>
                  <div className={css({ fontSize: '12px', color: '#c9d1d9', lineHeight: '1.5' })}>
                    {selected.manifest.sessionSummary}
                  </div>
                </div>
              )}

              {/* Moments */}
              {selected.manifest?.moments && selected.manifest.moments.length > 0 && (
                <div
                  className={css({
                    marginBottom: '16px',
                    backgroundColor: '#0d1117',
                    borderRadius: '8px',
                    padding: '12px',
                  })}
                >
                  <h3 className={css({ fontSize: '13px', marginBottom: '8px', color: '#58a6ff' })}>
                    Moments ({selected.manifest.moments.length})
                  </h3>
                  {selected.manifest.moments.map((m, i) => (
                    <div
                      key={i}
                      className={css({
                        padding: '8px',
                        borderBottom: '1px solid #21262d',
                        '&:last-child': { borderBottom: 'none' },
                      })}
                    >
                      <div
                        className={css({
                          display: 'flex',
                          gap: '8px',
                          alignItems: 'center',
                          marginBottom: '4px',
                        })}
                      >
                        <span
                          className={css({
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            backgroundColor: '#30363d',
                            color: '#c9d1d9',
                          })}
                        >
                          #{m.rank}
                        </span>
                        <span
                          className={css({
                            padding: '1px 6px',
                            borderRadius: '3px',
                            fontSize: '10px',
                            backgroundColor: '#1c2128',
                            color: '#8b949e',
                          })}
                        >
                          {m.category}
                        </span>
                        <span className={css({ fontSize: '12px', fontWeight: 'bold' })}>
                          {m.caption}
                        </span>
                      </div>
                      {m.transcriptExcerpt && (
                        <pre
                          className={css({
                            fontSize: '11px',
                            color: '#8b949e',
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            paddingLeft: '8px',
                            borderLeft: '2px solid #30363d',
                            marginTop: '4px',
                          })}
                        >
                          {m.transcriptExcerpt}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Task Tree */}
              <div
                className={css({
                  marginBottom: '16px',
                  backgroundColor: '#0d1117',
                  borderRadius: '8px',
                  padding: '12px',
                })}
              >
                <h3 className={css({ fontSize: '13px', marginBottom: '8px', color: '#58a6ff' })}>
                  Task Tree
                </h3>

                {selected.parentTask ? (
                  <div>
                    {/* Parent Task */}
                    <TaskRow
                      task={selected.parentTask}
                      isParent
                      getStatusColor={getStatusColor}
                      formatTime={formatTime}
                      formatDuration={formatDuration}
                    />

                    {/* Child Tasks */}
                    {selected.childTasks.length > 0 ? (
                      selected.childTasks.map((child) => (
                        <TaskRow
                          key={child.id}
                          task={child}
                          isParent={false}
                          getStatusColor={getStatusColor}
                          formatTime={formatTime}
                          formatDuration={formatDuration}
                        />
                      ))
                    ) : (
                      <div className={css({ padding: '8px', color: '#666', fontSize: '11px' })}>
                        No child tasks yet
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={css({ color: '#666', fontSize: '11px' })}>
                    No task associated with this postcard
                  </div>
                )}
              </div>

              {/* Review Results */}
              {selected.childTasks
                .filter((t) => t.type === 'postcard-review')
                .map((reviewTask) => (
                  <ReviewResults
                    key={reviewTask.id}
                    task={reviewTask}
                    getStatusColor={getStatusColor}
                  />
                ))}
            </div>
          ) : (
            <div
              className={css({
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: '#888',
              })}
            >
              Select a postcard to view details
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

function TaskRow({
  task,
  isParent,
  getStatusColor,
  formatTime,
  formatDuration,
}: {
  task: TaskInfo
  isParent: boolean
  getStatusColor: (s: string) => string
  formatTime: (s: string | null) => string
  formatDuration: (s: string | null, e: string | null) => string
}) {
  return (
    <div
      className={css({
        padding: '8px',
        marginLeft: isParent ? '0' : '20px',
        borderLeft: isParent ? 'none' : '2px solid #30363d',
        borderBottom: '1px solid #21262d',
        '&:last-child': { borderBottom: 'none' },
      })}
    >
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        })}
      >
        <span className={css({ fontWeight: isParent ? 'bold' : 'normal', fontSize: '12px' })}>
          {task.type}
        </span>
        <span
          className={css({
            padding: '1px 6px',
            borderRadius: '3px',
            fontSize: '10px',
            backgroundColor: getStatusColor(task.status),
            color: 'white',
          })}
        >
          {task.status}
        </span>
      </div>
      <div className={css({ fontSize: '10px', color: '#666' })}>{task.id}</div>
      {task.progressMessage && (
        <div className={css({ fontSize: '11px', color: '#888', marginTop: '2px' })}>
          {task.progress ?? 0}% - {task.progressMessage}
        </div>
      )}
      {task.error && (
        <div className={css({ fontSize: '11px', color: '#f44336', marginTop: '2px' })}>
          {task.error}
        </div>
      )}
      <div className={css({ fontSize: '10px', color: '#555', marginTop: '2px' })}>
        Created: {formatTime(task.createdAt)}
        {task.startedAt && ` | Duration: ${formatDuration(task.startedAt, task.completedAt)}`}
      </div>
    </div>
  )
}

function ReviewResults({
  task,
  getStatusColor,
}: {
  task: TaskInfo
  getStatusColor: (s: string) => string
}) {
  const output = task.output as Record<string, unknown> | null
  if (!output) return null

  // Review output may have criteria results
  const criteria = (output.criteria ?? output.results ?? output.checks) as
    | Array<{ name: string; passed: boolean; reason?: string }>
    | undefined

  const overallPass = output.passed ?? output.approved ?? output.overallPass

  return (
    <div
      className={css({
        marginBottom: '16px',
        backgroundColor: '#0d1117',
        borderRadius: '8px',
        padding: '12px',
      })}
    >
      <h3 className={css({ fontSize: '13px', marginBottom: '8px', color: '#58a6ff' })}>
        Review Results
        <span
          className={css({
            marginLeft: '8px',
            padding: '2px 8px',
            borderRadius: '4px',
            fontSize: '10px',
            backgroundColor: getStatusColor(task.status),
            color: 'white',
          })}
        >
          {task.status}
        </span>
        {overallPass !== undefined && (
          <span
            className={css({
              marginLeft: '8px',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              backgroundColor: overallPass ? '#4CAF50' : '#f44336',
              color: 'white',
            })}
          >
            {overallPass ? 'PASSED' : 'FAILED'}
          </span>
        )}
      </h3>

      {criteria && criteria.length > 0 ? (
        <table className={css({ width: '100%', borderCollapse: 'collapse' })}>
          <thead>
            <tr>
              <th
                className={css({
                  textAlign: 'left',
                  padding: '4px 8px',
                  color: '#888',
                  fontSize: '11px',
                  borderBottom: '1px solid #21262d',
                })}
              >
                Criterion
              </th>
              <th
                className={css({
                  textAlign: 'center',
                  padding: '4px 8px',
                  color: '#888',
                  fontSize: '11px',
                  borderBottom: '1px solid #21262d',
                  width: '60px',
                })}
              >
                Result
              </th>
              <th
                className={css({
                  textAlign: 'left',
                  padding: '4px 8px',
                  color: '#888',
                  fontSize: '11px',
                  borderBottom: '1px solid #21262d',
                })}
              >
                Reason
              </th>
            </tr>
          </thead>
          <tbody>
            {criteria.map((c, i) => (
              <tr key={i}>
                <td className={css({ padding: '4px 8px', fontSize: '12px' })}>{c.name}</td>
                <td className={css({ padding: '4px 8px', textAlign: 'center' })}>
                  <span
                    className={css({
                      color: c.passed ? '#4CAF50' : '#f44336',
                      fontWeight: 'bold',
                      fontSize: '12px',
                    })}
                  >
                    {c.passed ? 'PASS' : 'FAIL'}
                  </span>
                </td>
                <td className={css({ padding: '4px 8px', fontSize: '11px', color: '#8b949e' })}>
                  {c.reason || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <pre
          className={css({
            fontSize: '11px',
            color: '#8b949e',
            margin: 0,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
            maxHeight: '200px',
            overflow: 'auto',
          })}
        >
          {JSON.stringify(output, null, 2)}
        </pre>
      )}
    </div>
  )
}
