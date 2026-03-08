'use client'

/**
 * Admin Session Songs — observability dashboard for AI-generated celebration songs.
 *
 * Shows all songs with status, player, composition plan details, audio playback,
 * and retry controls for failed songs.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { AppNavBar } from '@/components/AppNavBar'
import { AdminNav } from '@/components/AdminNav'

// ============================================================================
// Types
// ============================================================================

interface SectionSummary {
  name: string
  durationMs: number
  lineCount: number
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
  backgroundTaskId: string | null
  fileExists: boolean
  fileSizeBytes: number | null
  durationSeconds: number | null
  createdAt: string
  completedAt: string | null
  styles: string[]
  totalDurationMs: number
  sectionSummary: SectionSummary[]
  promptInput: unknown
  llmOutput: unknown
}

interface Stats {
  total: number
  completed: number
  failed: number
  generating: number
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
  const [retrying, setRetrying] = useState<string | null>(null)

  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/songs')
      if (!res.ok) throw new Error('Failed to fetch songs')
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

  const handleRetry = useCallback(
    async (songId: string) => {
      setRetrying(songId)
      try {
        const res = await fetch('/api/admin/songs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ songId, action: 'retry' }),
        })
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.error ?? 'Retry failed')
        }
        // Refresh list
        await fetchSongs()
        setSelectedSongId(null)
      } catch (err) {
        alert(err instanceof Error ? err.message : 'Retry failed')
      } finally {
        setRetrying(null)
      }
    },
    [fetchSongs]
  )

  const filtered = statusFilter ? songs.filter((s) => s.status === statusFilter) : songs
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
              </div>
            )}

            {/* Filter */}
            <div className={css({ marginTop: '8px' })}>
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
              retrying={retrying === selectedSong.id}
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
    <div
      onClick={onClick}
      className={css({
        padding: '12px 16px',
        borderBottom: '1px solid #2a2a4a',
        cursor: 'pointer',
        backgroundColor: isSelected ? '#2a2a5a' : 'transparent',
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
        <StatusBadge status={song.status} />
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
    </div>
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
  retrying,
}: {
  song: Song
  onRetry: (songId: string) => void
  retrying: boolean
}) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)

  // Reset audio state when song changes
  useEffect(() => {
    setIsPlaying(false)
  }, [song.id])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (isPlaying) {
      audio.pause()
    } else {
      audio.play()
    }
  }, [isPlaying])

  const llmOutput = song.llmOutput as Record<string, unknown> | null
  const plan = llmOutput?.plan as Record<string, unknown> | null
  const sections = (plan?.sections as Array<Record<string, unknown>>) ?? []
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
          {song.status === 'failed' && (
            <button
              data-action="retry-song"
              onClick={() => onRetry(song.id)}
              disabled={retrying}
              className={css({
                padding: '6px 16px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: '#f44336',
                color: 'white',
                opacity: retrying ? 0.5 : 1,
                '&:hover': { backgroundColor: '#d32f2f' },
              })}
            >
              {retrying ? 'Retrying...' : 'Retry'}
            </button>
          )}
          <StatusBadge status={song.status} />
        </div>
      </div>

      {/* Audio Player (completed songs only) */}
      {song.status === 'completed' && song.fileExists && (
        <div
          className={css({
            padding: '12px 16px',
            backgroundColor: '#16213e',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          })}
        >
          <audio
            ref={audioRef}
            src={`/api/audio/songs/${song.id}`}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
          />
          <button
            data-action="toggle-play"
            onClick={togglePlay}
            className={css({
              width: '36px',
              height: '36px',
              borderRadius: 'full',
              backgroundColor: '#7c3aed',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
              '&:hover': { backgroundColor: '#6d28d9' },
            })}
          >
            {isPlaying ? '\u23F8' : '\u25B6'}
          </button>
          <div className={css({ fontSize: '12px', color: '#8b949e' })}>
            {song.durationSeconds ? `${song.durationSeconds.toFixed(1)}s` : 'audio available'}
            {song.fileSizeBytes && (
              <span className={css({ marginLeft: '8px' })}>
                ({(song.fileSizeBytes / 1024).toFixed(0)} KB)
              </span>
            )}
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
            ['Trigger', song.triggerSource ?? '-'],
            ['Task ID', song.backgroundTaskId ?? '-'],
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
            <TagList tags={(plan.positive_global_styles as string[]) ?? []} color="#4CAF50" />
            {((plan.negative_global_styles as string[]) ?? []).length > 0 && (
              <>
                <Label>Negative Styles</Label>
                <TagList tags={(plan.negative_global_styles as string[]) ?? []} color="#f44336" />
              </>
            )}
          </div>
          <div className={css({ marginBottom: '8px', fontSize: '11px', color: '#8b949e' })}>
            Total planned duration: {(song.totalDurationMs / 1000).toFixed(1)}s across{' '}
            {sections.length} sections
          </div>

          {/* Sections with lyrics */}
          {sections.map((section, i) => {
            const lines = (section.lines as string[]) ?? []
            const localStyles = (section.positive_local_styles as string[]) ?? []
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
                    {section.section_name as string}
                  </span>
                  <span className={css({ fontSize: '11px', color: '#666' })}>
                    {((section.duration_ms as number) / 1000).toFixed(1)}s
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
