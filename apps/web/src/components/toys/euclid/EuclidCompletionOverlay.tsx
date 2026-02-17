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
 * Post-completion overlay shown after Q.E.F. in EuclidCanvas.
 * Displays what was completed, what was unlocked, and navigation options.
 */
export function EuclidCompletionOverlay({
  propositionId,
  unlocked,
  nextPropId,
  onNavigateNext,
  onNavigateMap,
}: EuclidCompletionOverlayProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Fade in after a short delay to let Q.E.F. settle
    const timer = setTimeout(() => setVisible(true), 800)
    return () => clearTimeout(timer)
  }, [])

  const prop = getProposition(propositionId)
  const propTitle = prop ? `I.${propositionId}` : `I.${propositionId}`

  return (
    <div
      data-component="euclid-completion-overlay"
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(250, 250, 240, 0.85)',
        backdropFilter: 'blur(4px)',
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.5s ease',
        zIndex: 20,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        data-element="completion-card"
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: '32px 40px',
          maxWidth: 400,
          width: '90%',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(16, 185, 129, 0.2)',
          transform: visible ? 'translateY(0)' : 'translateY(12px)',
          transition: 'transform 0.5s ease',
          textAlign: 'center',
        }}
      >
        {/* Green banner */}
        <div
          data-element="completion-banner"
          style={{
            color: '#10b981',
            fontSize: 22,
            fontWeight: 700,
            fontFamily: 'Georgia, serif',
            marginBottom: 8,
          }}
        >
          Proposition {propTitle} Complete
        </div>

        {prop && (
          <div
            style={{
              color: '#6b7280',
              fontSize: 13,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              marginBottom: 20,
            }}
          >
            {prop.title}
          </div>
        )}

        {/* Unlocked section */}
        {unlocked.length > 0 && (
          <div
            data-element="unlocked-section"
            style={{
              marginBottom: 24,
              padding: '12px 16px',
              background: 'rgba(16, 185, 129, 0.06)',
              borderRadius: 10,
              border: '1px solid rgba(16, 185, 129, 0.15)',
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: '#10b981',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: 8,
              }}
            >
              Unlocked
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {unlocked.map(id => {
                const p = getProposition(id)
                return (
                  <div
                    key={id}
                    style={{
                      fontSize: 14,
                      color: '#374151',
                      fontFamily: 'Georgia, serif',
                    }}
                  >
                    <strong>I.{id}</strong>
                    {p && <span style={{ color: '#6b7280' }}> — {p.title}</span>}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div
          data-element="completion-nav"
          style={{
            display: 'flex',
            gap: 12,
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          {nextPropId && (
            <button
              type="button"
              data-action="navigate-next"
              onClick={() => onNavigateNext(nextPropId)}
              style={{
                padding: '10px 24px',
                fontSize: 15,
                fontWeight: 600,
                fontFamily: 'Georgia, serif',
                background: '#10b981',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = '#059669' }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = '#10b981' }}
            >
              Next: I.{nextPropId} →
            </button>
          )}

          <button
            type="button"
            data-action="navigate-map"
            onClick={onNavigateMap}
            style={{
              padding: '10px 24px',
              fontSize: 15,
              fontWeight: 600,
              fontFamily: 'Georgia, serif',
              background: 'transparent',
              color: '#6b7280',
              border: '1px solid #d1d5db',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => {
              const btn = e.target as HTMLButtonElement
              btn.style.borderColor = '#9ca3af'
              btn.style.color = '#374151'
            }}
            onMouseLeave={e => {
              const btn = e.target as HTMLButtonElement
              btn.style.borderColor = '#d1d5db'
              btn.style.color = '#6b7280'
            }}
          >
            Back to Map
          </button>
        </div>
      </div>
    </div>
  )
}
