'use client'

import { useEffect, useMemo, useRef } from 'react'
import { BYRNE } from '../types'
import { CITATIONS } from '../engine/citations'
import { PROP_REGISTRY } from '../propositions/registry'
import { buildFinalState } from '../render/buildFinalStates'
import { FOUNDATION_ITEMS, FOUNDATION_DIAGRAMS } from './foundationsData'
import { EuclidFoundationCanvas } from './EuclidFoundationCanvas'
import { getFoundationIdForCitation, getFoundationHref, getPropositionHref, getPropIdForCitation } from './citationUtils'

const POPOVER_WIDTH = 248

/** Accent color for the citation label, keyed by citation prefix. */
function labelColor(citationKey: string): string {
  if (citationKey.startsWith('Def.')) return BYRNE.red
  if (citationKey.startsWith('Post.')) return BYRNE.yellow
  if (citationKey.startsWith('C.N.')) return BYRNE.blue
  return BYRNE.given
}

interface CitationPopoverProps {
  citationKey: string
  anchorRect: DOMRect
  onClose: () => void
  /** Called when the pointer enters the popover — lets caller cancel close timers. */
  onMouseEnter?: () => void
  /** Called when the pointer leaves the popover. */
  onMouseLeave?: () => void
}

export function CitationPopover({
  citationKey,
  anchorRect,
  onClose,
  onMouseEnter,
  onMouseLeave,
}: CitationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)

  // Resolve content
  const citDef = CITATIONS[citationKey]
  const foundationId = getFoundationIdForCitation(citationKey)
  const foundationItem = foundationId ? FOUNDATION_ITEMS.find((f) => f.id === foundationId) : null
  const diagram = foundationId ? FOUNDATION_DIAGRAMS[foundationId] : null

  // For proposition citations (I.1, I.2, …)
  const propMatch = citationKey.match(/^I\.(\d+)$/)
  const propId = propMatch ? parseInt(propMatch[1], 10) : null
  const propDef = propId != null ? PROP_REGISTRY[propId] : null

  // Build the completed construction state (falls back to givenElements if not yet implemented)
  const propFinalElements = useMemo(() => {
    if (propId == null) return null
    const finalState = buildFinalState(propId)
    return finalState?.elements ?? null
  }, [propId])

  // Synthetic diagram from completed proposition elements (for mini canvas)
  const propDiagram =
    propDef && !diagram
      ? {
          id: `prop-${propId}`,
          title: citDef?.label ?? citationKey,
          elements: propFinalElements ?? propDef.givenElements,
        }
      : null

  const activeDiagram = diagram ?? propDiagram ?? null
  const foundationHref = getFoundationHref(citationKey)
  const propositionHref = getPropIdForCitation(citationKey) != null ? getPropositionHref(citationKey) : null

  // Positioning: prefer left of anchor (into canvas), fall back to above/below
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  const preferredLeft = anchorRect.left - POPOVER_WIDTH - 8
  const fitsLeft = preferredLeft >= 16

  let left: number
  let top: number

  if (fitsLeft) {
    left = preferredLeft
    // Center vertically on anchor, clamped to viewport
    top = Math.max(16, Math.min(vh - 400, anchorRect.top + anchorRect.height / 2 - 150))
  } else {
    // Place above the anchor, horizontally aligned to it
    left = Math.max(16, Math.min(vw - POPOVER_WIDTH - 16, anchorRect.left))
    top = anchorRect.top - 8 - 300 // 300 = rough popover height estimate
    if (top < 16) {
      // Fall back to below
      top = anchorRect.bottom + 8
    }
    top = Math.max(16, Math.min(vh - 400, top))
  }

  // Keyboard dismiss
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const accentColor = labelColor(citationKey)
  const label = citDef?.label ?? citationKey
  const title = foundationItem?.title ?? propDef?.title ?? null
  const statement = foundationItem?.statement ?? citDef?.text ?? null
  const plain = foundationItem?.plain ?? null

  return (
    <div
      ref={popoverRef}
      data-component="citation-popover"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        position: 'fixed',
        left,
        top,
        width: POPOVER_WIDTH,
        zIndex: 500,
        background: 'rgba(252, 252, 248, 0.97)',
        border: '1px solid rgba(203, 213, 225, 0.8)',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(15, 23, 42, 0.08)',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        animation: 'euclid-popover-in 0.12s ease-out',
        pointerEvents: 'auto',
      }}
    >
      <style>{`
        @keyframes euclid-popover-in {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>

      {/* Label */}
      <div
        style={{
          fontSize: '0.7rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: accentColor,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        {label}
        {title && (
          <span style={{ color: '#1e293b', marginLeft: 6, fontWeight: 600 }}>— {title}</span>
        )}
      </div>

      {/* Mini canvas */}
      {activeDiagram && (
        <div style={{ width: '100%', height: 140 }}>
          <EuclidFoundationCanvas diagram={activeDiagram} />
        </div>
      )}

      {/* Statement */}
      {statement && (
        <div
          style={{
            fontSize: '0.82rem',
            color: '#1e293b',
            fontFamily: 'Georgia, serif',
            fontStyle: 'italic',
            lineHeight: 1.5,
          }}
        >
          {statement}
        </div>
      )}

      {/* Plain English */}
      {plain && (
        <div
          style={{
            fontSize: '0.78rem',
            color: '#64748b',
            fontFamily: 'system-ui, sans-serif',
            lineHeight: 1.45,
            paddingTop: 2,
            borderTop: '1px solid rgba(203, 213, 225, 0.5)',
          }}
        >
          {plain}
        </div>
      )}

      {/* Foundation page link (opens in new tab) */}
      {foundationHref && (
        <a
          href={foundationHref}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '0.72rem',
            color: '#10b981',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            paddingTop: 2,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
        >
          Open full page →
        </a>
      )}

      {/* Proposition page link (navigates in-page) */}
      {propositionHref && (
        <a
          href={propositionHref}
          style={{
            fontSize: '0.72rem',
            color: '#10b981',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: 600,
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            paddingTop: 2,
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
        >
          Open proposition →
        </a>
      )}
    </div>
  )
}
