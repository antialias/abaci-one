'use client'

import { useState } from 'react'
import { useEuclidCreations, type CreationsTab } from '@/hooks/useEuclidCreations'

/** Format a relative time string like "2h ago", "5m ago", "3d ago". */
function relativeTime(date: Date | string | null | undefined): string {
  if (!date) return ''
  const d = typeof date === 'string' ? new Date(date) : date
  const now = Date.now()
  const diffMs = now - d.getTime()
  if (diffMs < 0) return 'just now'

  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`

  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

interface Props {
  onClose: () => void
  /** Load a creation in-place (Mine tab only). */
  onLoad?: (id: string) => void
  currentId?: string | null
  playerId?: string | null
}

export function PlaygroundCreationsPanel({ onClose, onLoad, currentId, playerId }: Props) {
  const [tab, setTab] = useState<CreationsTab>('mine')
  const { data: creations = [], isLoading } = useEuclidCreations(tab, playerId)

  const tabStyle = (t: CreationsTab) => ({
    padding: '6px 14px',
    borderRadius: 8,
    border: 'none',
    background: tab === t ? '#4E79A7' : 'transparent',
    color: tab === t ? '#fff' : '#374151',
    fontWeight: 600,
    fontSize: 13,
    fontFamily: 'system-ui, sans-serif',
    cursor: 'pointer',
  })

  /** Whether items in this tab should load in-place (vs navigate). */
  const isLoadable = tab === 'mine' && !!onLoad

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.35)',
          zIndex: 40,
        }}
      />

      {/* Panel */}
      <div
        data-component="playground-creations-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(400px, 100vw)',
          background: '#fff',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.15)',
          zIndex: 41,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 16px 12px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 700,
              color: '#1A1A2E',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Creations
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#6b7280',
              lineHeight: 1,
              padding: '2px 6px',
            }}
          >
            ×
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: 4,
            padding: '10px 12px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <button style={tabStyle('mine')} onClick={() => setTab('mine')}>
            Mine
          </button>
          <button style={tabStyle('published')} onClick={() => setTab('published')}>
            Published
          </button>
          <button style={tabStyle('seen')} onClick={() => setTab('seen')}>
            Seen
          </button>
        </div>

        {/* Grid */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 12,
          }}
        >
          {isLoading ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: '#9ca3af',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
              }}
            >
              Loading...
            </div>
          ) : creations.length === 0 ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: '#9ca3af',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
              }}
            >
              {tab === 'seen' ? 'No creations from share links yet.' : 'Nothing here yet.'}
            </div>
          ) : (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: 10,
              }}
            >
              {creations.map((c) => {
                const isCurrent = c.id === currentId
                const cardContent = (
                  <>
                    {c.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={c.thumbnail}
                        alt={c.title || 'Creation preview'}
                        style={{
                          width: '100%',
                          aspectRatio: '4/3',
                          objectFit: 'cover',
                          display: 'block',
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '100%',
                          aspectRatio: '4/3',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#d1d5db',
                          fontSize: 28,
                        }}
                      >
                        ◯
                      </div>
                    )}
                    {/* Info bar: badge + title + timestamp */}
                    <div
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        fontFamily: 'system-ui, sans-serif',
                        color: '#6b7280',
                        background: '#f9fafb',
                        borderTop: '1px solid #f3f4f6',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span
                          style={{
                            padding: '1px 5px',
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 600,
                            background: c.isPublic
                              ? 'rgba(78,121,167,0.12)'
                              : 'rgba(107,114,128,0.12)',
                            color: c.isPublic ? '#4E79A7' : '#6b7280',
                          }}
                        >
                          {c.isPublic ? 'Public' : 'Draft'}
                        </span>
                        <span
                          style={{
                            marginLeft: 'auto',
                            fontSize: 9,
                            color: '#9ca3af',
                          }}
                        >
                          {relativeTime(c.updatedAt ?? c.createdAt)}
                        </span>
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#374151',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {c.title || 'Untitled'}
                      </div>
                    </div>
                  </>
                )

                const cardStyle = {
                  display: 'block',
                  textDecoration: 'none',
                  borderRadius: 10,
                  overflow: 'hidden' as const,
                  border: isCurrent ? '2px solid #4E79A7' : '1px solid #e5e7eb',
                  background: '#FAFAF0',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  cursor: 'pointer',
                }

                // Mine tab: load in-place. Other tabs: navigate.
                if (isLoadable) {
                  return (
                    <button
                      key={c.id}
                      onClick={() => onLoad(c.id)}
                      style={{
                        ...cardStyle,
                        padding: 0,
                        textAlign: 'left' as const,
                        fontFamily: 'inherit',
                      }}
                    >
                      {cardContent}
                    </button>
                  )
                }

                return (
                  <a key={c.id} href={`/toys/euclid/creations/${c.id}`} style={cardStyle}>
                    {cardContent}
                  </a>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
