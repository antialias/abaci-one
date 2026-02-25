'use client'

import { useEffect, useState } from 'react'
import { getProposition } from './data/propositionGraph'

interface EuclidCompletionOverlayProps {
  propositionId: number
  unlocked: number[]
  nextPropId: number | null
  onNavigateNext: (propId: number) => void
  onNavigateMap: () => void
}

/**
 * Non-blocking completion banner — slides in at the bottom-left of the canvas
 * after Q.E.F., showing unlocks and navigation without covering anything.
 */
export function EuclidCompletionOverlay({
  propositionId,
  unlocked,
  nextPropId,
  onNavigateNext,
  onNavigateMap,
}: EuclidCompletionOverlayProps) {
  const [visible, setVisible] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 768px)')
    const update = () => setIsMobile(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  if (dismissed) return null

  const prop = getProposition(propositionId)
  const positionStyle = isMobile
    ? {
        top: 'calc(var(--app-nav-height) + 12px)',
        right: 16,
        bottom: 'auto',
        left: 'auto',
        maxWidth: 280,
      }
    : {
        bottom: 16,
        left: 16,
        top: 'auto',
        right: 'auto',
        maxWidth: 320,
      }

  return (
    <div
      data-component="euclid-completion-banner"
      style={{
        position: 'absolute',
        ...positionStyle,
        background: '#fff',
        borderRadius: 12,
        padding: '14px 18px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.10), 0 0 0 1px rgba(16, 185, 129, 0.2)',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 0.4s ease, transform 0.4s ease',
        zIndex: 10,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Dismiss button */}
      <button
        type="button"
        data-action="dismiss-banner"
        onClick={() => setDismissed(true)}
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: 'none',
          border: 'none',
          fontSize: 14,
          color: '#9ca3af',
          cursor: 'pointer',
          padding: '2px 4px',
          lineHeight: 1,
        }}
      >
        ×
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span
          style={{ color: '#10b981', fontSize: 13, fontWeight: 700, fontFamily: 'Georgia, serif' }}
        >
          ✓ I.{propositionId}
        </span>
        {prop && (
          <span
            style={{
              color: '#6b7280',
              fontSize: 11,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
            }}
          >
            {prop.title}
          </span>
        )}
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div
          style={{ fontSize: 12, color: '#374151', fontFamily: 'Georgia, serif', marginBottom: 8 }}
        >
          <span style={{ color: '#10b981', fontWeight: 600 }}>Unlocked: </span>
          {unlocked.map((id, i) => {
            const p = getProposition(id)
            return (
              <span key={id}>
                {i > 0 && ', '}
                <strong>I.{id}</strong>
                {p && <span style={{ color: '#6b7280' }}> ({truncate(p.title, 20)})</span>}
              </span>
            )
          })}
        </div>
      )}

      {/* Navigation */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {nextPropId && (
          <button
            type="button"
            data-action="navigate-next"
            onClick={() => onNavigateNext(nextPropId)}
            style={{
              padding: '5px 14px',
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'Georgia, serif',
              background: '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
            }}
          >
            Next: I.{nextPropId} →
          </button>
        )}
        <button
          type="button"
          data-action="navigate-map"
          onClick={onNavigateMap}
          style={{
            padding: '5px 14px',
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
            background: 'transparent',
            color: '#6b7280',
            border: '1px solid #d1d5db',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          Map
        </button>
      </div>
    </div>
  )
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + '…'
}
