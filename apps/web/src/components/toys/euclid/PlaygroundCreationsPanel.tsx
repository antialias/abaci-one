'use client'

import { useState } from 'react'
import { useEuclidCreations, type CreationsTab } from '@/hooks/useEuclidCreations'

interface Props {
  onClose: () => void
  currentId?: string | null
  playerId?: string | null
}

export function PlaygroundCreationsPanel({ onClose, currentId, playerId }: Props) {
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
              Loading…
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
              {creations.map((c) => (
                <a
                  key={c.id}
                  href={`/toys/euclid/creations/${c.id}`}
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    borderRadius: 10,
                    overflow: 'hidden',
                    border: c.id === currentId ? '2px solid #4E79A7' : '1px solid #e5e7eb',
                    background: '#FAFAF0',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  {c.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={c.thumbnail}
                      alt="Creation preview"
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
                  {c.isPublic && (
                    <div
                      style={{
                        padding: '3px 8px',
                        fontSize: 10,
                        fontFamily: 'system-ui, sans-serif',
                        color: '#6b7280',
                        background: '#f9fafb',
                        borderTop: '1px solid #f3f4f6',
                      }}
                    >
                      Public
                    </div>
                  )}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
