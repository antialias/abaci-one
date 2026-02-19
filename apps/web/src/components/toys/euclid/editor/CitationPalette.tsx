'use client'

import { useState, useCallback } from 'react'
import { CITATIONS } from '../engine/citations'
import { MACRO_REGISTRY } from '../engine/macros'
import { PROPOSITION_REFS } from './propositionReference'

interface CitationPaletteProps {
  propositionId: number
  activeCitation: string | null
  onSelect: (citation: string) => void
  usedCitations: string[]
  onAddFactStep: (citation: string, instruction: string) => void
}

interface CitationGroup {
  label: string
  citations: { key: string; label: string; text?: string; inDeps: boolean }[]
}

function isFactOnlyCitation(citation: string): boolean {
  return citation.startsWith('Def.') ||
    citation.startsWith('C.N.') ||
    citation === 'Given'
}

export function CitationPalette({
  propositionId,
  activeCitation,
  onSelect,
  usedCitations,
  onAddFactStep,
}: CitationPaletteProps) {
  const ref = PROPOSITION_REFS[propositionId]
  const deps = new Set(ref?.deps ?? [])
  const [hoveredCitation, setHoveredCitation] = useState<string | null>(null)
  const [factText, setFactText] = useState('')
  const [showFactForm, setShowFactForm] = useState(false)

  // Count uses per citation
  const useCounts = new Map<string, number>()
  for (const cit of usedCitations) {
    useCounts.set(cit, (useCounts.get(cit) ?? 0) + 1)
  }

  // Build groups
  const groups: CitationGroup[] = []

  // Postulates
  groups.push({
    label: 'Postulates',
    citations: ['Post.1', 'Post.2', 'Post.3'].map(key => ({
      key,
      label: key,
      text: CITATIONS[key]?.text,
      inDeps: deps.has(key),
    })),
  })

  // Definitions
  groups.push({
    label: 'Definitions',
    citations: ['Def.15', 'Def.20'].map(key => ({
      key,
      label: key,
      text: CITATIONS[key]?.text,
      inDeps: deps.has(key),
    })),
  })

  // Common Notions
  groups.push({
    label: 'Common Notions',
    citations: ['C.N.1', 'C.N.2', 'C.N.3', 'C.N.4', 'Given'].map(key => ({
      key,
      label: key,
      text: CITATIONS[key]?.text,
      inDeps: deps.has(key),
    })),
  })

  // Propositions (only those < current and in MACRO_REGISTRY)
  const propCitations: { key: string; label: string; text?: string; inDeps: boolean }[] = []
  for (let i = 1; i < propositionId; i++) {
    if (MACRO_REGISTRY[i]) {
      const key = `I.${i}`
      propCitations.push({
        key,
        label: key,
        text: CITATIONS[key]?.text ?? PROPOSITION_REFS[i]?.title,
        inDeps: deps.has(key),
      })
    }
  }
  if (propCitations.length > 0) {
    groups.push({
      label: 'Propositions',
      citations: propCitations,
    })
  }

  const handleClick = useCallback((key: string) => {
    if (isFactOnlyCitation(key)) {
      // For fact-only citations, show the text input form
      setShowFactForm(true)
      onSelect(key)
    } else {
      setShowFactForm(false)
      setFactText('')
      onSelect(key)
    }
  }, [onSelect])

  const handleFactSubmit = useCallback(() => {
    if (activeCitation && factText.trim()) {
      onAddFactStep(activeCitation, factText.trim())
      setFactText('')
      setShowFactForm(false)
    }
  }, [activeCitation, factText, onAddFactStep])

  // Tooltip content
  const tooltipCitation = hoveredCitation || activeCitation
  const tooltipDef = tooltipCitation ? CITATIONS[tooltipCitation] : null

  return (
    <div
      data-element="citation-palette"
      style={{
        padding: '12px 20px',
        borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
      }}
    >
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 8,
        fontFamily: 'system-ui, sans-serif',
      }}>
        Citation
      </div>

      {groups.map(group => (
        <div key={group.label} style={{ marginBottom: 8 }}>
          <div style={{
            fontSize: 10,
            fontWeight: 500,
            color: '#94a3b8',
            marginBottom: 4,
            fontFamily: 'system-ui, sans-serif',
          }}>
            {group.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {group.citations.map(cit => {
              const count = useCounts.get(cit.key) ?? 0
              const isActive = activeCitation === cit.key
              return (
                <button
                  key={cit.key}
                  data-action={`select-citation-${cit.key}`}
                  onClick={() => handleClick(cit.key)}
                  onMouseEnter={() => setHoveredCitation(cit.key)}
                  onMouseLeave={() => setHoveredCitation(null)}
                  style={{
                    position: 'relative',
                    padding: '4px 8px',
                    borderRadius: 4,
                    border: isActive
                      ? '2px solid #4E79A7'
                      : '1px solid rgba(203, 213, 225, 0.6)',
                    background: isActive
                      ? 'rgba(78, 121, 167, 0.1)'
                      : 'white',
                    color: cit.inDeps ? '#334155' : '#94a3b8',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'system-ui, sans-serif',
                    transition: 'all 0.1s',
                    opacity: cit.inDeps ? 1 : 0.6,
                  }}
                >
                  {cit.key}
                  {count > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      width: 16,
                      height: 16,
                      borderRadius: '50%',
                      background: '#4E79A7',
                      color: '#fff',
                      fontSize: 9,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Tooltip / context */}
      {tooltipDef && (
        <div style={{
          marginTop: 8,
          padding: '6px 10px',
          borderRadius: 6,
          background: 'rgba(78, 121, 167, 0.06)',
          border: '1px solid rgba(78, 121, 167, 0.15)',
          fontSize: 11,
          color: '#475569',
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
          lineHeight: 1.4,
        }}>
          <strong style={{ fontStyle: 'normal' }}>{tooltipDef.label}</strong>
          {tooltipDef.text && <span> — {tooltipDef.text}</span>}
        </div>
      )}

      {/* Fact-only citation form */}
      {showFactForm && activeCitation && isFactOnlyCitation(activeCitation) && (
        <div style={{ marginTop: 8 }}>
          <div style={{
            fontSize: 11,
            color: '#64748b',
            marginBottom: 4,
            fontFamily: 'system-ui, sans-serif',
          }}>
            Statement for {activeCitation}:
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              data-element="fact-text-input"
              value={factText}
              onChange={e => setFactText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleFactSubmit()}
              placeholder="e.g., AB = CD by definition..."
              style={{
                flex: 1,
                padding: '6px 10px',
                borderRadius: 6,
                border: '1px solid rgba(203, 213, 225, 0.5)',
                fontSize: 12,
                fontFamily: 'Georgia, serif',
                outline: 'none',
              }}
              autoFocus
            />
            <button
              data-action="submit-fact"
              onClick={handleFactSubmit}
              disabled={!factText.trim()}
              style={{
                padding: '6px 12px',
                borderRadius: 6,
                border: 'none',
                background: factText.trim() ? '#4E79A7' : 'rgba(78, 121, 167, 0.3)',
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                cursor: factText.trim() ? 'pointer' : 'default',
              }}
            >
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
