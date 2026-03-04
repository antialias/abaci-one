/**
 * Side panel for given-setup mode.
 * Replaces the ProofLedger when the admin is setting up givens.
 *
 * Adapted from the editor's inline GivenSetupPanel (EuclidEditor.tsx).
 */

import { useState, useMemo } from 'react'
import type { SerializedElement, SerializedEqualityFact } from './types'
import { BYRNE } from './types'

interface GivenSetupPanelProps {
  givenElements: SerializedElement[]
  givenFacts: SerializedEqualityFact[]
  onRenamePoint: (pointId: string, newLabel: string) => void
  onDeleteElement: (elementId: string) => void
  onAddFact: (leftA: string, leftB: string, rightA: string, rightB: string) => void
  onDeleteFact: (index: number) => void
  onStartConstruction: () => void
  onCancel: () => void
}

const panelStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  fontFamily: 'system-ui, sans-serif',
  fontSize: 13,
  color: '#1A1A2E',
  overflow: 'auto',
}

const sectionStyle: React.CSSProperties = {
  padding: '12px 16px',
  borderBottom: '1px solid rgba(203,213,225,0.4)',
}

const headingStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
  color: '#6b7280',
  marginBottom: 8,
}

const listItemStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 0',
}

const deleteButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#9ca3af',
  cursor: 'pointer',
  fontSize: 14,
  padding: '0 4px',
  lineHeight: 1,
}

const buttonBase: React.CSSProperties = {
  padding: '7px 13px',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 600,
  fontFamily: 'system-ui, sans-serif',
  cursor: 'pointer',
  border: 'none',
  transition: 'background 0.15s, opacity 0.15s',
}

export function GivenSetupPanel({
  givenElements,
  givenFacts,
  onRenamePoint,
  onDeleteElement,
  onAddFact,
  onDeleteFact,
  onStartConstruction,
  onCancel,
}: GivenSetupPanelProps) {
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [eqLeft, setEqLeft] = useState('')
  const [eqRight, setEqRight] = useState('')

  const points = useMemo(
    () => givenElements.filter((el) => el.kind === 'point'),
    [givenElements]
  )
  const segments = useMemo(
    () => givenElements.filter((el) => el.kind === 'segment'),
    [givenElements]
  )

  // Generate segment pair options for equality fact UI
  const segmentPairs = useMemo(() => {
    const pairs: Array<{ key: string; label: string; fromId: string; toId: string }> = []
    for (const seg of segments) {
      const fromPt = points.find((p) => p.id === seg.fromId)
      const toPt = points.find((p) => p.id === seg.toId)
      if (fromPt && toPt) {
        pairs.push({
          key: `${seg.fromId}:${seg.toId}`,
          label: `${fromPt.label}${toPt.label}`,
          fromId: seg.fromId!,
          toId: seg.toId!,
        })
      }
    }
    return pairs
  }, [segments, points])

  const canStartConstruction = points.length >= 2

  const handleRenameStart = (id: string, currentLabel: string) => {
    setRenamingId(id)
    setRenameValue(currentLabel)
  }

  const handleRenameCommit = () => {
    if (renamingId && renameValue.trim()) {
      onRenamePoint(renamingId, renameValue.trim().toUpperCase())
    }
    setRenamingId(null)
    setRenameValue('')
  }

  const handleAddFact = () => {
    if (!eqLeft || !eqRight || eqLeft === eqRight) return
    const [leftA, leftB] = eqLeft.split(':')
    const [rightA, rightB] = eqRight.split(':')
    onAddFact(leftA, leftB, rightA, rightB)
    setEqLeft('')
    setEqRight('')
  }

  return (
    <div style={panelStyle} data-component="given-setup-panel">
      {/* Instructions */}
      <div style={{ ...sectionStyle, background: 'rgba(78,121,167,0.06)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>Given Setup Mode</div>
        <div style={{ color: '#6b7280', fontSize: 12, lineHeight: 1.4 }}>
          Use <strong>Point</strong> tool to place given points.{' '}
          <strong>Straightedge</strong> to add segments between them.
        </div>
      </div>

      {/* Points list */}
      <div style={sectionStyle}>
        <div style={headingStyle}>Points ({points.length})</div>
        {points.length === 0 && (
          <div style={{ color: '#9ca3af', fontSize: 12, fontStyle: 'italic' }}>
            Click the canvas to place points
          </div>
        )}
        {points.map((pt) => (
          <div key={pt.id} style={listItemStyle}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: BYRNE.given,
                flexShrink: 0,
              }}
            />
            {renamingId === pt.id ? (
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameCommit()
                  if (e.key === 'Escape') {
                    setRenamingId(null)
                    setRenameValue('')
                  }
                }}
                onBlur={handleRenameCommit}
                maxLength={2}
                style={{
                  width: 32,
                  padding: '2px 4px',
                  fontSize: 13,
                  fontWeight: 600,
                  border: `1px solid ${BYRNE.blue}`,
                  borderRadius: 4,
                  outline: 'none',
                  textAlign: 'center',
                }}
              />
            ) : (
              <span
                style={{ fontWeight: 600, cursor: 'pointer', minWidth: 20 }}
                onDoubleClick={() => handleRenameStart(pt.id!, pt.label ?? '')}
                title="Double-click to rename"
              >
                {pt.label}
              </span>
            )}
            <span style={{ color: '#9ca3af', fontSize: 11 }}>
              ({pt.x?.toFixed(1)}, {pt.y?.toFixed(1)})
            </span>
            <span style={{ flex: 1 }} />
            <button
              style={deleteButtonStyle}
              onClick={() => onDeleteElement(pt.id!)}
              title="Delete point"
            >
              x
            </button>
          </div>
        ))}
      </div>

      {/* Segments list */}
      {segments.length > 0 && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Segments ({segments.length})</div>
          {segments.map((seg) => {
            const fromPt = points.find((p) => p.id === seg.fromId)
            const toPt = points.find((p) => p.id === seg.toId)
            return (
              <div key={seg.id} style={listItemStyle}>
                <span style={{ fontWeight: 600 }}>
                  {fromPt?.label ?? '?'}{toPt?.label ?? '?'}
                </span>
                <span style={{ flex: 1 }} />
                <button
                  style={deleteButtonStyle}
                  onClick={() => onDeleteElement(seg.id!)}
                  title="Delete segment"
                >
                  x
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Equality constraints */}
      {segmentPairs.length >= 2 && (
        <div style={sectionStyle}>
          <div style={headingStyle}>Equal Segments</div>

          {/* Existing facts */}
          {givenFacts.map((fact, i) => (
            <div key={i} style={{ ...listItemStyle, fontSize: 12 }}>
              <span style={{ fontWeight: 600 }}>{fact.statement}</span>
              <span style={{ flex: 1 }} />
              <button
                style={deleteButtonStyle}
                onClick={() => onDeleteFact(i)}
                title="Remove constraint"
              >
                x
              </button>
            </div>
          ))}

          {/* Add new fact */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
            <select
              value={eqLeft}
              onChange={(e) => setEqLeft(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 12,
                borderRadius: 4,
                border: '1px solid #d1d5db',
              }}
            >
              <option value="">--</option>
              {segmentPairs.map((sp) => (
                <option key={sp.key} value={sp.key}>
                  {sp.label}
                </option>
              ))}
            </select>
            <span style={{ color: '#9ca3af', fontWeight: 600 }}>=</span>
            <select
              value={eqRight}
              onChange={(e) => setEqRight(e.target.value)}
              style={{
                flex: 1,
                padding: '4px 6px',
                fontSize: 12,
                borderRadius: 4,
                border: '1px solid #d1d5db',
              }}
            >
              <option value="">--</option>
              {segmentPairs
                .filter((sp) => sp.key !== eqLeft)
                .map((sp) => (
                  <option key={sp.key} value={sp.key}>
                    {sp.label}
                  </option>
                ))}
            </select>
            <button
              onClick={handleAddFact}
              disabled={!eqLeft || !eqRight || eqLeft === eqRight}
              style={{
                ...buttonBase,
                padding: '4px 10px',
                fontSize: 12,
                background:
                  eqLeft && eqRight && eqLeft !== eqRight ? BYRNE.blue : '#e5e7eb',
                color: eqLeft && eqRight && eqLeft !== eqRight ? '#fff' : '#9ca3af',
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ padding: '16px', marginTop: 'auto', display: 'flex', gap: 8 }}>
        <button
          onClick={onCancel}
          style={{
            ...buttonBase,
            flex: 1,
            background: 'rgba(255,255,255,0.9)',
            border: '1px solid rgba(203,213,225,0.9)',
            color: '#374151',
          }}
        >
          Cancel
        </button>
        <button
          onClick={onStartConstruction}
          disabled={!canStartConstruction}
          style={{
            ...buttonBase,
            flex: 2,
            background: canStartConstruction ? '#10b981' : '#e5e7eb',
            color: canStartConstruction ? '#fff' : '#9ca3af',
            opacity: canStartConstruction ? 1 : 0.6,
          }}
        >
          Start Construction
        </button>
      </div>
    </div>
  )
}
