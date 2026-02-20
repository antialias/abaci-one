'use client'

import { useState } from 'react'
import { PROPOSITION_REFS } from './propositionReference'

interface PropositionInfoProps {
  propositionId: number
  authorNotes: string
  onAuthorNotesChange: (notes: string) => void
}

export function PropositionInfo({
  propositionId,
  authorNotes,
  onAuthorNotesChange,
}: PropositionInfoProps) {
  const ref = PROPOSITION_REFS[propositionId]
  const [showReference, setShowReference] = useState(false)

  if (!ref) {
    return (
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(203, 213, 225, 0.5)' }}>
        <div style={{ fontSize: 14, color: '#94a3b8' }}>
          Proposition I.{propositionId} — not found
        </div>
      </div>
    )
  }

  return (
    <div
      data-element="proposition-info"
      style={{
        borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
      }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px 12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#94a3b8',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontFamily: 'system-ui, sans-serif',
            }}
          >
            Proposition I.{propositionId}
          </span>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 20,
              height: 18,
              borderRadius: 3,
              fontSize: 10,
              fontWeight: 700,
              background: ref.type === 'C' ? 'rgba(78, 121, 167, 0.15)' : 'rgba(225, 87, 89, 0.15)',
              color: ref.type === 'C' ? '#4E79A7' : '#E15759',
            }}
          >
            {ref.type}
          </span>
        </div>
        <div
          style={{
            fontSize: 14,
            fontWeight: 500,
            color: '#334155',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            lineHeight: 1.4,
          }}
        >
          {ref.title}
        </div>
      </div>

      {/* Statement */}
      <div style={{ padding: '0 20px 8px' }}>
        <div
          style={{
            fontSize: 12,
            color: '#475569',
            fontFamily: 'Georgia, serif',
            lineHeight: 1.5,
          }}
        >
          {ref.statement}
        </div>
      </div>

      {/* Dependencies */}
      <div style={{ padding: '0 20px 8px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {ref.deps.map((dep) => (
            <span
              key={dep}
              style={{
                display: 'inline-block',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 10,
                fontWeight: 600,
                background: 'rgba(78, 121, 167, 0.08)',
                color: '#4E79A7',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              {dep}
            </span>
          ))}
        </div>
      </div>

      {/* Expandable reference notes */}
      <div style={{ padding: '0 20px' }}>
        <button
          data-action="toggle-reference"
          onClick={() => setShowReference(!showReference)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 11,
            fontWeight: 500,
            color: '#94a3b8',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 0',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <span
            style={{
              transform: showReference ? 'rotate(90deg)' : 'rotate(0deg)',
              transition: 'transform 0.15s',
              display: 'inline-block',
            }}
          >
            &#9654;
          </span>
          Reference notes
        </button>
        {showReference && (
          <div
            style={{
              fontSize: 11,
              color: '#64748b',
              fontFamily: 'Georgia, serif',
              lineHeight: 1.5,
              padding: '4px 0 8px',
            }}
          >
            {ref.method && (
              <div style={{ marginBottom: 4 }}>
                <strong>Method:</strong> {ref.method}
              </div>
            )}
            {ref.note && (
              <div>
                <strong>Note:</strong> {ref.note}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Author notes */}
      <div style={{ padding: '8px 20px 12px' }}>
        <div
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: '#94a3b8',
            marginBottom: 4,
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          My notes
        </div>
        <textarea
          data-element="author-notes"
          value={authorNotes}
          onChange={(e) => onAuthorNotesChange(e.target.value)}
          placeholder="Observations, strategies, gotchas..."
          style={{
            width: '100%',
            minHeight: 48,
            padding: '8px 10px',
            borderRadius: 6,
            border: '1px solid rgba(203, 213, 225, 0.5)',
            background: 'rgba(255, 255, 255, 0.6)',
            fontSize: 12,
            fontFamily: 'Georgia, serif',
            lineHeight: 1.4,
            color: '#334155',
            resize: 'vertical',
            outline: 'none',
          }}
        />
      </div>
    </div>
  )
}
