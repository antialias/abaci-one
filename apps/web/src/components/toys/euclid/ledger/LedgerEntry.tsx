'use client'

/**
 * Individual entry in the construction log.
 *
 * Shows a citation badge (e.g. [Post.1]) and a marked description with
 * hoverable entity references. Click the description to edit it.
 */

import type React from 'react'
import { useState, useRef, useEffect } from 'react'
import { MarkedText } from '@/lib/character/MarkedText'
import { stripEntityMarkers } from '@/lib/character/parseEntityMarkers'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import type { EuclidEntityRef } from '../chat/parseGeometricEntities'

interface LedgerEntryProps {
  index: number
  citation: string | null
  markedDescription: string
  isEditing: boolean
  isLoadingMarkup: boolean
  onStartEdit: () => void
  onCommitEdit: (text: string) => void
  onCancelEdit: () => void
  renderEntity: (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode
  isGiven?: boolean
}

/** Color for citation badge by type */
function citationColor(citation: string | null): string {
  if (!citation) return '#94a3b8'
  if (citation === 'Given') return '#8b7355'
  if (citation.startsWith('Post.')) return '#6b9b6b'
  if (citation.startsWith('I.')) return '#4E79A7'
  return '#94a3b8'
}

export function LedgerEntry({
  citation,
  markedDescription,
  isEditing,
  isLoadingMarkup,
  onStartEdit,
  onCommitEdit,
  onCancelEdit,
  renderEntity,
  isGiven,
}: LedgerEntryProps) {
  const [editText, setEditText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) {
      // Initialize edit text from stripped markers
      setEditText(stripEntityMarkers(markedDescription, EUCLID_ENTITY_MARKERS))
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.select()
      }
    }
  }, [isEditing, markedDescription])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      onCommitEdit(editText)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancelEdit()
    }
  }

  return (
    <div
      data-element="ledger-entry"
      style={{
        display: 'flex',
        gap: 8,
        padding: '4px 0',
        alignItems: 'baseline',
        borderRadius: 4,
        cursor: isGiven ? undefined : 'pointer',
        fontStyle: isGiven ? 'italic' : undefined,
        opacity: isGiven ? 0.8 : 1,
      }}
      onClick={isGiven || isEditing ? undefined : () => onStartEdit()}
    >
      {/* Citation badge */}
      <span
        data-element="citation-badge"
        style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'system-ui, sans-serif',
          color: citationColor(citation),
          whiteSpace: 'nowrap',
          minWidth: 40,
          textAlign: 'right',
          flexShrink: 0,
        }}
      >
        {citation ? `[${citation}]` : ''}
      </span>

      {/* Description */}
      <span
        data-element="ledger-description"
        style={{
          fontSize: 13,
          fontFamily: 'Georgia, serif',
          lineHeight: 1.4,
          color: isGiven ? '#78716c' : '#475569',
          flex: 1,
        }}
      >
        {isEditing ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              ref={inputRef}
              data-element="ledger-edit-input"
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={onCancelEdit}
              style={{
                flex: 1,
                fontSize: 13,
                fontFamily: 'Georgia, serif',
                border: '1px solid rgba(78, 121, 167, 0.3)',
                borderRadius: 3,
                padding: '2px 6px',
                outline: 'none',
                background: 'white',
                color: '#475569',
              }}
            />
            {isLoadingMarkup && <span style={{ fontSize: 10, color: '#94a3b8' }}>...</span>}
          </span>
        ) : (
          <MarkedText
            text={markedDescription}
            markers={EUCLID_ENTITY_MARKERS}
            onHighlight={() => {}}
            renderEntity={renderEntity}
          />
        )}
      </span>
    </div>
  )
}
