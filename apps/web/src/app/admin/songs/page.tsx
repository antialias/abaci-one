'use client'

/**
 * Admin Session Songs — observability dashboard for AI-generated celebration songs.
 *
 * Shows all songs with status, player, composition plan details, audio playback,
 * and retry controls for failed songs.
 */

import { useCallback, useEffect, useState } from 'react'
import { AdminNav } from '@/components/AdminNav'
import { AppNavBar } from '@/components/AppNavBar'
import { SystemHealthBanner } from '@/components/admin/SystemHealthBanner'
import { SyncedLyricsPlayer } from '@/components/song/SyncedLyricsPlayer'
import { parseSongPlan } from '@/lib/song-share/songPlan'
import type { SongLyricsSection } from '@/lib/song/alignment'
import { css } from '../../../../styled-system/css'

// ============================================================================
// Types
// ============================================================================

interface SectionSummary {
  name: string
  durationMs: number
  lineCount: number
}

interface ValidationIssue {
  code: string
  message: string
  evidenceType: string | null
}

interface Song {
  id: string
  sessionPlanId: string
  playerId: string
  playerName: string
  playerEmoji: string
  status: string
  title: string | null
  triggerSource: string | null
  errorMessage: string | null
  failureKind: string | null
  backgroundTaskId: string | null
  contentReviewStatus: 'none' | 'flagged' | 'resolved'
  contentReviewNote: string | null
  contentReviewedAt: string | null
  contentReviewedBy: string | null
  regenerationCount: number
  lastRegenerationReason: string | null
  lastRegenerationAt: string | null
  fileExists: boolean
  fileSizeBytes: number | null
  alignmentExists: boolean
  lyrics: SongLyricsSection[]
  durationSeconds: number | null
  createdAt: string
  completedAt: string | null
  styles: string[]
  totalDurationMs: number
  sectionSummary: SectionSummary[]
  validationMode: string | null
  validationOutcome: string | null
  validationIssueCount: number
  validationIssues: ValidationIssue[]
  repairAttempts: number | null
  fallbackUsed: boolean
  promptInput: unknown
  llmOutput: unknown
}

interface Stats {
  total: number
  completed: number
  failed: number
  generating: number
  flagged: number
  validationFlagged: number
  validationRepaired: number
  validationFallback: number
  validationBlocked: number
}

type RegenerationMode = 'auto' | 'reuse_prompt' | 'regenerate_prompt'

async function getApiErrorMessage(res: Response, fallback: string): Promise<string> {
  let detail = ''

  try {
    const contentType = res.headers.get('content-type') ?? ''
    if (contentType.includes('application/json')) {
      const data = (await res.json()) as { error?: unknown; message?: unknown }
      const value = data.error ?? data.message
      detail = typeof value === 'string' ? value : ''
    } else {
      detail = await res.text()
    }
  } catch {
    detail = ''
  }

  const status = [res.status, res.statusText].filter(Boolean).join(' ')
  const message = `${fallback}${status ? ` (${status})` : ''}`
  const normalizedDetail = detail.trim().replace(/\s+/g, ' ')
  const authDetail =
    res.status === 401
      ? 'Authentication required'
      : res.status === 403 && (!normalizedDetail || normalizedDetail === 'Forbidden')
        ? 'Admin access required'
        : normalizedDetail
  const cleanDetail = authDetail.slice(0, 240)

  return cleanDetail ? `${message}: ${cleanDetail}` : message
}

// ============================================================================
// Page
// ============================================================================

export default function AdminSongsPage() {
  const [songs, setSongs] = useState<Song[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedSongId, setSelectedSongId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [validationFilter, setValidationFilter] = useState<string | null>(null)
  const [busySongId, setBusySongId] = useState<string | null>(null)

  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/songs')
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Failed to fetch songs'))
      const data = await res.json()
      setSongs(data.songs)
      setStats(data.stats)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSongs()
    const interval = setInterval(fetchSongs, 10000)
    return () => clearInterval(interval)
  }, [fetchSongs])

  const postSongAction = useCallback(async (body: Record<string, unknown>) => {
    const res = await fetch('/api/admin/songs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      throw new Error(await getApiErrorMessage(res, 'Song action failed'))
    }
  }, [])

  const handleRetry = useCallback(
    async (songId: string, mode: RegenerationMode = 'auto', reason?: string) => {
      setBusySongId(songId)
      try {
        await postSongAction({ songId, action: 'retry', mode, reason })
        await fetchSongs()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Retry failed')
      } finally {
        setBusySongId(null)
      }
    },
    [fetchSongs, postSongAction]
  )

  const handleFlagContent = useCallback(
    async (songId: string, reason: string) => {
      setBusySongId(songId)
      try {
        await postSongAction({ songId, action: 'flag_content', reason })
        await fetchSongs()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Flag failed')
      } finally {
        setBusySongId(null)
      }
    },
    [fetchSongs, postSongAction]
  )

  const handleClearContentFlag = useCallback(
    async (songId: string) => {
      setBusySongId(songId)
      try {
        await postSongAction({ songId, action: 'clear_content_flag' })
        await fetchSongs()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Clear failed')
      } finally {
        setBusySongId(null)
      }
    },
    [fetchSongs, postSongAction]
  )

  const handleSpawn = useCallback(
    async (songId: string) => {
      setBusySongId(songId)
      try {
        await postSongAction({ songId, action: 'spawn' })
        await fetchSongs()
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Spawn failed')
      } finally {
        setBusySongId(null)
      }
    },
    [fetchSongs, postSongAction]
  )

  const filtered = songs.filter((song) => {
    if (statusFilter && song.status !== statusFilter) return false
    if (!validationFilter) return true
    if (validationFilter === 'content_flagged') return song.contentReviewStatus === 'flagged'
    if (validationFilter === 'flagged') return song.validationIssueCount > 0
    if (validationFilter === 'clean') {
      return song.validationOutcome === 'passed' || song.validationOutcome === 'skipped'
    }
    return song.validationOutcome === validationFilter
  })
  const selectedSong = selectedSongId ? songs.find((s) => s.id === selectedSongId) : null

  if (loading) {
    return (
      <PageShell>
        <div className={css({ padding: '24px', fontFamily: 'monospace' })}>Loading songs...</div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <div className={css({ padding: '24px', fontFamily: 'monospace', color: '#f44336' })}>
          Error: {error}
        </div>
      </PageShell>
    )
  }

  const headerHeight = 56 + 54

  return (
    <PageShell>
      <div
        className={css({
          display: 'flex',
          height: `calc(100vh - ${headerHeight}px)`,
          fontFamily: 'monospace',
          fontSize: '13px',
        })}
      >
        {/* Song List */}
        <div
          className={css({
            width: '420px',
            borderRight: '1px solid #333',
            overflow: 'auto',
            flexShrink: 0,
          })}
        >
          {/* Header with stats */}
          <div
            className={css({
              padding: '12px 16px',
              borderBottom: '1px solid #333',
              backgroundColor: '#16213e',
            })}
          >
            <div className={css({ fontWeight: 'bold', fontSize: '14px' })}>
              Session Songs ({filtered.length}
              {filtered.length !== songs.length ? ` / ${songs.length}` : ''})
            </div>

            {/* Stats bar */}
            {stats && (
              <div
                className={css({
                  display: 'flex',
                  gap: '12px',
                  marginTop: '8px',
                  fontSize: '11px',
                })}
              >
                <StatBadge label="Total" value={stats.total} color="#8b949e" />
                <StatBadge label="OK" value={stats.completed} color="#4CAF50" />
                <StatBadge label="Failed" value={stats.failed} color="#f44336" />
                <StatBadge label="Active" value={stats.generating} color="#2196F3" />
                <StatBadge label="Content" value={stats.flagged} color="#d97706" />
                <StatBadge label="Flagged" value={stats.validationFlagged} color="#ff9800" />
                <StatBadge label="Repaired" value={stats.validationRepaired} color="#00bcd4" />
                <StatBadge label="Fallback" value={stats.validationFallback} color="#9c27b0" />
                <StatBadge label="Blocked" value={stats.validationBlocked} color="#e91e63" />
              </div>
            )}

            {/* Filter */}
            <div className={css({ marginTop: '8px', display: 'grid', gap: '6px' })}>
              <select
                data-element="status-filter"
                value={statusFilter ?? ''}
                onChange={(e) => setStatusFilter(e.target.value || null)}
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
                <option value="prompt_generating">Prompt Generating</option>
                <option value="generating">Generating Music</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
              </select>
              <select
                data-element="validation-filter"
                value={validationFilter ?? ''}
                onChange={(e) => setValidationFilter(e.target.value || null)}
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
                <option value="">All validation outcomes</option>
                <option value="content_flagged">Content flagged</option>
                <option value="flagged">Any validation issue</option>
                <option value="clean">Clean/skipped</option>
                <option value="repaired">Repaired</option>
                <option value="fallback">Fallback</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>
          </div>

          {/* Song rows */}
          {filtered.length === 0 ? (
            <div className={css({ padding: '16px', color: '#888' })}>No songs found</div>
          ) : (
            filtered.map((song) => (
              <SongRow
                key={song.id}
                song={song}
                isSelected={selectedSongId === song.id}
                onClick={() => setSelectedSongId(song.id)}
              />
            ))
          )}
        </div>

        {/* Detail Panel */}
        <div className={css({ flex: 1, overflow: 'auto' })}>
          {selectedSong ? (
            <SongDetail
              song={selectedSong}
              onRetry={handleRetry}
              onSpawn={handleSpawn}
              onFlagContent={handleFlagContent}
              onClearContentFlag={handleClearContentFlag}
              busy={busySongId === selectedSong.id}
            />
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
              Select a song to view details
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}

// ============================================================================
// Components
// ============================================================================

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-component="admin-songs-page"
      className={css({
        minHeight: '100vh',
        backgroundColor: '#1a1a2e',
        color: '#eee',
      })}
    >
      <AppNavBar />
      <div className={css({ paddingTop: '56px' })}>
        <AdminNav />
      </div>
      <div className={css({ padding: '16px 16px 0' })}>
        <SystemHealthBanner />
      </div>
      {children}
    </div>
  )
}

function StatBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <span className={css({ display: 'flex', alignItems: 'center', gap: '4px' })}>
      <span
        className={css({ width: '8px', height: '8px', borderRadius: 'full', flexShrink: 0 })}
        style={{ backgroundColor: color }}
      />
      <span style={{ color }}>{value}</span>
      <span className={css({ color: '#666' })}>{label}</span>
    </span>
  )
}

function SongRow({
  song,
  isSelected,
  onClick,
}: {
  song: Song
  isSelected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={css({
        width: '100%',
        padding: '12px 16px',
        borderBottom: '1px solid #2a2a4a',
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#2a2a5a' : 'transparent',
        color: 'inherit',
        textAlign: 'left',
        '&:hover': { backgroundColor: '#2a2a4a' },
      })}
    >
      {/* Row 1: Player + Status */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '4px',
        })}
      >
        <span className={css({ fontWeight: 'bold' })}>
          {song.playerEmoji} {song.playerName}
        </span>
        <div className={css({ display: 'flex', gap: '4px', alignItems: 'center' })}>
          <ContentReviewBadge status={song.contentReviewStatus} />
          <ValidationBadge song={song} />
          <AlignmentBadge song={song} />
          <StatusBadge status={song.status} />
        </div>
      </div>

      {/* Row 2: Title or ID */}
      <div
        className={css({
          fontSize: '12px',
          color: song.title ? '#c9d1d9' : '#666',
          marginBottom: '4px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        })}
      >
        {song.title ?? song.id}
      </div>

      {/* Row 3: Meta */}
      <div className={css({ fontSize: '10px', color: '#666', display: 'flex', gap: '8px' })}>
        <span>{formatTimestamp(song.createdAt)}</span>
        {song.triggerSource && (
          <span className={css({ color: '#555' })}>
            {song.triggerSource === 'smart_trigger' ? 'smart' : 'fallback'}
          </span>
        )}
        {song.styles.length > 0 && (
          <span className={css({ color: '#555' })}>{song.styles.slice(0, 2).join(', ')}</span>
        )}
        {song.status === 'completed' && song.fileSizeBytes && (
          <span className={css({ color: '#4CAF50' })}>
            {(song.fileSizeBytes / 1024).toFixed(0)}KB
          </span>
        )}
      </div>

      {/* Error preview */}
      {song.errorMessage && (
        <div
          className={css({
            fontSize: '11px',
            color: '#f44336',
            marginTop: '4px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          })}
        >
          {song.errorMessage}
        </div>
      )}
    </button>
  )
}

function ContentReviewBadge({ status }: { status: Song['contentReviewStatus'] }) {
  if (status === 'none') return null
  const color = status === 'flagged' ? '#d97706' : '#2e7d32'
  return (
    <span
      data-element="content-review-badge"
      className={css({
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        color: 'white',
      })}
      style={{ backgroundColor: color }}
    >
      {status === 'flagged' ? 'content' : 'resolved'}
    </span>
  )
}

function ValidationBadge({ song }: { song: Song }) {
  if (!song.validationOutcome || song.validationOutcome === 'skipped') return null

  const flagged = song.validationIssueCount > 0
  const label =
    song.validationOutcome === 'passed'
      ? 'valid'
      : song.validationOutcome === 'flagged'
        ? `flagged ${song.validationIssueCount}`
        : song.validationOutcome
  const color =
    song.validationOutcome === 'passed'
      ? '#2e7d32'
      : song.validationOutcome === 'repaired'
        ? '#00838f'
        : song.validationOutcome === 'fallback'
          ? '#7b1fa2'
          : song.validationOutcome === 'blocked'
            ? '#c2185b'
            : flagged
              ? '#ef6c00'
              : '#666'

  return (
    <span
      data-element="validation-badge"
      className={css({
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        color: 'white',
      })}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}

function AlignmentBadge({ song }: { song: Song }) {
  if (song.status !== 'completed') return null
  const color = song.alignmentExists ? '#0ea5e9' : '#475569'
  const label = song.alignmentExists ? 'synced' : 'no sync'
  return (
    <span
      data-element="alignment-badge"
      data-has-alignment={song.alignmentExists ? 'true' : 'false'}
      className={css({
        padding: '2px 6px',
        borderRadius: '4px',
        fontSize: '10px',
        color: 'white',
      })}
      style={{ backgroundColor: color }}
    >
      {label}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const color = getStatusColor(status)
  return (
    <span
      className={css({
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '11px',
        color: 'white',
      })}
      style={{ backgroundColor: color }}
    >
      {status}
    </span>
  )
}

function SongDetail({
  song,
  onRetry,
  onSpawn,
  onFlagContent,
  onClearContentFlag,
  busy,
}: {
  song: Song
  onRetry: (songId: string, mode?: RegenerationMode, reason?: string) => void
  onSpawn: (songId: string) => void
  onFlagContent: (songId: string, reason: string) => void
  onClearContentFlag: (songId: string) => void
  busy: boolean
}) {
  const [contentReason, setContentReason] = useState('')

  useEffect(() => {
    setContentReason(song.contentReviewNote ?? '')
  }, [song.id, song.contentReviewNote])

  const llmOutput = song.llmOutput as Record<string, unknown> | null
  const plan = llmOutput?.plan as Record<string, unknown> | null
  const parsedPlan = parseSongPlan(song.llmOutput)
  const sections = parsedPlan.sections
  const hasCompositionPlan = sections.length > 0
  const promptInput = song.promptInput as Record<string, unknown> | null
  const llmMeta = llmOutput?.llmMeta as {
    provider?: string
    model?: string
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number }
    attempts?: number
  } | null

  return (
    <div className={css({ padding: '16px' })}>
      {/* Header */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          marginBottom: '16px',
        })}
      >
        <div>
          <h2 className={css({ fontSize: '18px', marginBottom: '4px' })}>
            {song.playerEmoji} {song.title ?? 'Untitled Song'}
          </h2>
          <div className={css({ fontSize: '12px', color: '#8b949e' })}>
            for {song.playerName} &middot; {song.id}
          </div>
        </div>
        <div className={css({ display: 'flex', gap: '8px', alignItems: 'center' })}>
          <ActionButton
            dataAction="spawn-song"
            tone="secondary"
            disabled={busy}
            onClick={() => onSpawn(song.id)}
          >
            {busy ? 'Queueing...' : 'Spawn copy'}
          </ActionButton>
          {song.status === 'failed' && (
            <>
              <ActionButton
                dataAction="retry-song"
                tone="danger"
                disabled={busy}
                onClick={() => onRetry(song.id, 'auto')}
              >
                {busy ? 'Queueing...' : hasCompositionPlan ? 'Retry music' : 'Retry'}
              </ActionButton>
              {hasCompositionPlan && (
                <ActionButton
                  dataAction="regenerate-song-prompt"
                  tone="secondary"
                  disabled={busy}
                  onClick={() => onRetry(song.id, 'regenerate_prompt')}
                >
                  Regenerate lyrics
                </ActionButton>
              )}
            </>
          )}
          {song.contentReviewStatus === 'flagged' && !isSongActive(song.status) && (
            <ActionButton
              dataAction="regenerate-flagged-song"
              tone="warning"
              disabled={busy}
              onClick={() =>
                onRetry(
                  song.id,
                  'regenerate_prompt',
                  song.contentReviewNote ?? 'Content review regeneration'
                )
              }
            >
              {busy ? 'Queueing...' : 'Regenerate'}
            </ActionButton>
          )}
          <StatusBadge status={song.status} />
        </div>
      </div>

      {/* Integrated player + lyrics \u2014 uses the same SyncedLyricsPlayer the
          kid celebration card and share page use, so admins can sanity-check
          the alignment exactly as families experience it. */}
      {song.status === 'completed' && song.fileExists && (
        <div className={css({ marginBottom: '16px' })}>
          <SyncedLyricsPlayer
            audioPath={`/api/audio/songs/${song.id}`}
            alignmentPath={song.alignmentExists ? `/api/audio/songs/${song.id}/alignment` : null}
            lyrics={song.lyrics}
            title={song.title}
            variant="full"
          />
          <div
            className={css({
              fontSize: '11px',
              color: '#8b949e',
              marginTop: '6px',
              display: 'flex',
              gap: '12px',
            })}
          >
            <span>
              {song.durationSeconds ? `${song.durationSeconds.toFixed(1)}s` : 'duration unknown'}
            </span>
            {song.fileSizeBytes && <span>{(song.fileSizeBytes / 1024).toFixed(0)} KB</span>}
            <span>{song.alignmentExists ? 'synced lyrics available' : 'no alignment data'}</span>
          </div>
        </div>
      )}

      {/* File warning */}
      {song.status === 'completed' && !song.fileExists && (
        <div
          className={css({
            padding: '8px 12px',
            backgroundColor: '#f44336',
            borderRadius: '6px',
            fontSize: '12px',
            marginBottom: '16px',
          })}
        >
          MP3 file missing from disk! Expected at localFilePath.
        </div>
      )}

      {/* Metadata table */}
      <DetailSection title="Metadata">
        <InfoTable
          rows={[
            ['Song ID', song.id],
            ['Plan ID', song.sessionPlanId],
            ['Player ID', song.playerId],
            ['Status', song.status],
            ['Failure Kind', song.failureKind ?? '-'],
            ['Trigger', song.triggerSource ?? '-'],
            ['Task ID', song.backgroundTaskId ?? '-'],
            ['Regenerations', String(song.regenerationCount ?? 0)],
            [
              'Last Regeneration',
              song.lastRegenerationAt ? formatTimestamp(song.lastRegenerationAt) : '-',
            ],
            ['Last Reason', song.lastRegenerationReason ?? '-'],
            ['Created', formatTimestamp(song.createdAt)],
            ['Completed', song.completedAt ? formatTimestamp(song.completedAt) : '-'],
            [
              'Duration',
              song.createdAt && song.completedAt
                ? formatDuration(song.createdAt, song.completedAt)
                : '-',
            ],
          ]}
        />
      </DetailSection>

      {/* Content Review */}
      <DetailSection title="Content Review">
        <InfoTable
          rows={[
            ['Status', song.contentReviewStatus],
            ['Reviewed', song.contentReviewedAt ? formatTimestamp(song.contentReviewedAt) : '-'],
            ['Reviewed By', song.contentReviewedBy ?? '-'],
            ['Note', song.contentReviewNote ?? '-'],
          ]}
        />
        {song.contentReviewStatus === 'flagged' ? (
          <div className={css({ display: 'flex', gap: '8px', marginTop: '10px' })}>
            <ActionButton
              dataAction="regenerate-content-song"
              tone="warning"
              disabled={busy || isSongActive(song.status)}
              onClick={() =>
                onRetry(
                  song.id,
                  'regenerate_prompt',
                  song.contentReviewNote ?? 'Content review regeneration'
                )
              }
            >
              Regenerate lyrics
            </ActionButton>
            <ActionButton
              dataAction="clear-content-flag"
              tone="secondary"
              disabled={busy}
              onClick={() => onClearContentFlag(song.id)}
            >
              Clear flag
            </ActionButton>
          </div>
        ) : (
          song.status === 'completed' && (
            <div className={css({ marginTop: '10px', display: 'grid', gap: '8px' })}>
              <textarea
                data-element="content-review-note"
                value={contentReason}
                onChange={(e) => setContentReason(e.target.value)}
                placeholder="What seems inaccurate or under-informed?"
                className={css({
                  minHeight: '72px',
                  backgroundColor: '#0d1117',
                  color: '#eee',
                  border: '1px solid #333',
                  borderRadius: '6px',
                  padding: '8px 10px',
                  fontSize: '12px',
                  resize: 'vertical',
                })}
              />
              <div>
                <ActionButton
                  dataAction="flag-content"
                  tone="warning"
                  disabled={busy || contentReason.trim().length === 0}
                  onClick={() => onFlagContent(song.id, contentReason.trim())}
                >
                  Flag content
                </ActionButton>
              </div>
            </div>
          )
        )}
      </DetailSection>

      {/* LLM Info */}
      {llmMeta && (
        <DetailSection title="LLM">
          <InfoTable
            rows={[
              ['Provider', llmMeta.provider ?? '-'],
              ['Model', llmMeta.model ?? '-'],
              ['Prompt Tokens', String(llmMeta.usage?.promptTokens ?? '-')],
              ['Completion Tokens', String(llmMeta.usage?.completionTokens ?? '-')],
              ['Total Tokens', String(llmMeta.usage?.totalTokens ?? '-')],
              ['Attempts', String(llmMeta.attempts ?? '-')],
            ]}
          />
        </DetailSection>
      )}

      {/* Plan Validation */}
      {song.validationOutcome && (
        <DetailSection title="Plan Validation">
          <InfoTable
            rows={[
              ['Mode', song.validationMode ?? '-'],
              ['Outcome', song.validationOutcome],
              ['Issues', String(song.validationIssueCount)],
              ['Repair Attempts', String(song.repairAttempts ?? 0)],
              ['Fallback Used', song.fallbackUsed ? 'yes' : 'no'],
            ]}
          />
          {song.validationIssues.length > 0 && (
            <div className={css({ marginTop: '8px', display: 'grid', gap: '6px' })}>
              {song.validationIssues.map((issue, index) => (
                <div
                  key={`${issue.code}-${index}`}
                  data-element="validation-issue"
                  className={css({
                    padding: '8px 10px',
                    backgroundColor: '#20160f',
                    borderLeft: '3px solid #ff9800',
                    borderRadius: '4px',
                    fontSize: '12px',
                  })}
                >
                  <div className={css({ color: '#ffb74d', fontWeight: 'bold' })}>
                    {issue.code}
                    {issue.evidenceType ? ` / ${issue.evidenceType}` : ''}
                  </div>
                  <div className={css({ color: '#c9d1d9', marginTop: '2px' })}>
                    {issue.message || '-'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DetailSection>
      )}

      {/* Error */}
      {song.errorMessage && (
        <DetailSection title="Error">
          <pre
            className={css({
              fontSize: '12px',
              color: '#f44336',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              margin: 0,
            })}
          >
            {song.errorMessage}
          </pre>
        </DetailSection>
      )}

      {/* Composition Plan */}
      {plan && (
        <DetailSection title="Composition Plan">
          <div className={css({ marginBottom: '8px' })}>
            <Label>Global Styles</Label>
            <TagList tags={parsedPlan.globalStyles} color="#4CAF50" />
            {parsedPlan.negativeGlobalStyles.length > 0 && (
              <>
                <Label>Negative Styles</Label>
                <TagList tags={parsedPlan.negativeGlobalStyles} color="#f44336" />
              </>
            )}
          </div>
          <div className={css({ marginBottom: '8px', fontSize: '11px', color: '#8b949e' })}>
            Total planned duration: {(song.totalDurationMs / 1000).toFixed(1)}s across{' '}
            {sections.length} sections
          </div>

          {/* Sections with lyrics */}
          {sections.map((section, i) => {
            const lines = section.lines
            const localStyles = section.localStyles
            return (
              <div
                key={i}
                className={css({
                  marginBottom: '12px',
                  padding: '8px 12px',
                  backgroundColor: '#0d1117',
                  borderRadius: '6px',
                  borderLeft: '3px solid #7c3aed',
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '4px',
                  })}
                >
                  <span className={css({ fontWeight: 'bold', fontSize: '12px' })}>
                    {section.name}
                  </span>
                  <span className={css({ fontSize: '11px', color: '#666' })}>
                    {(section.durationMs / 1000).toFixed(1)}s
                  </span>
                </div>
                {localStyles.length > 0 && (
                  <div className={css({ marginBottom: '4px' })}>
                    <TagList tags={localStyles} color="#666" />
                  </div>
                )}
                <div
                  className={css({
                    fontSize: '12px',
                    color: '#c9d1d9',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.5',
                  })}
                >
                  {lines.join('\n')}
                </div>
              </div>
            )
          })}
        </DetailSection>
      )}

      {/* Prompt Input (session stats fed to LLM) */}
      {promptInput && (
        <DetailSection title="Session Stats (LLM Input)">
          <JsonBlock data={promptInput} />
        </DetailSection>
      )}

      {/* Raw LLM Output */}
      {llmOutput && (
        <DetailSection title="Raw LLM Output">
          <JsonBlock data={llmOutput} />
        </DetailSection>
      )}
    </div>
  )
}

// ============================================================================
// Shared small components
// ============================================================================

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={css({ marginBottom: '16px' })}>
      <h3
        className={css({
          fontSize: '13px',
          fontWeight: 'bold',
          color: '#8b949e',
          marginBottom: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        })}
      >
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className={css({ width: '100%', borderCollapse: 'collapse' })}>
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <td className={css({ padding: '3px 8px', color: '#666', width: '120px' })}>{label}</td>
            <td className={css({ padding: '3px 8px', wordBreak: 'break-all' })}>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ActionButton({
  children,
  dataAction,
  tone,
  disabled,
  onClick,
}: {
  children: React.ReactNode
  dataAction: string
  tone: 'danger' | 'warning' | 'secondary'
  disabled?: boolean
  onClick: () => void
}) {
  const colors = {
    danger: { bg: '#f44336', border: '#f44336', fg: 'white', hover: '#d32f2f' },
    warning: { bg: '#d97706', border: '#d97706', fg: 'white', hover: '#b45309' },
    secondary: { bg: 'transparent', border: '#475569', fg: '#cbd5e1', hover: '#1e293b' },
  }[tone]

  return (
    <button
      data-action={dataAction}
      disabled={disabled}
      onClick={onClick}
      className={css({
        padding: '6px 12px',
        borderRadius: '6px',
        fontSize: '12px',
        fontWeight: 'bold',
        border: '1px solid',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
      })}
      style={{ backgroundColor: colors.bg, borderColor: colors.border, color: colors.fg }}
      onMouseEnter={(event) => {
        if (!disabled) event.currentTarget.style.backgroundColor = colors.hover
      }}
      onMouseLeave={(event) => {
        if (!disabled) event.currentTarget.style.backgroundColor = colors.bg
      }}
    >
      {children}
    </button>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className={css({ fontSize: '11px', color: '#666', marginBottom: '2px' })}>{children}</div>
  )
}

function TagList({ tags, color }: { tags: string[]; color: string }) {
  return (
    <div className={css({ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '6px' })}>
      {tags.map((tag) => (
        <span
          key={tag}
          className={css({
            padding: '1px 8px',
            borderRadius: '4px',
            fontSize: '11px',
            border: '1px solid',
          })}
          style={{ borderColor: color, color }}
        >
          {tag}
        </span>
      ))}
    </div>
  )
}

function JsonBlock({ data }: { data: unknown }) {
  return (
    <pre
      className={css({
        fontSize: '11px',
        color: '#8b949e',
        backgroundColor: '#0d1117',
        borderRadius: '6px',
        padding: '8px 12px',
        margin: 0,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        maxHeight: '300px',
        overflow: 'auto',
      })}
    >
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}

// ============================================================================
// Helpers
// ============================================================================

function isSongActive(status: string): boolean {
  return status === 'pending' || status === 'prompt_generating' || status === 'generating'
}

function getStatusColor(status: string): string {
  switch (status) {
    case 'pending':
      return '#888'
    case 'prompt_generating':
      return '#FF9800'
    case 'generating':
      return '#2196F3'
    case 'completed':
      return '#4CAF50'
    case 'failed':
      return '#f44336'
    default:
      return '#888'
  }
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString()
}

function formatDuration(startStr: string, endStr: string): string {
  const ms = new Date(endStr).getTime() - new Date(startStr).getTime()
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}
