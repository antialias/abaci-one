'use client'

import { useState } from 'react'
import { BYRNE, BYRNE_CYCLE } from './types'
import type { MacroPhase } from './types'
import type { MacroDef } from './engine/macros'
import { PropThumbnailStandalone } from './render/PropThumbnailSvg'
import { usePropPreviews } from './render/usePropPreviews'
import { getProposition } from './data/book1'

interface MacroEntry {
  propId: number
  def: MacroDef
  title: string
}

interface MacroToolPanelProps {
  macros: MacroEntry[]
  macroPhase: MacroPhase
  /** propId required by the current guided step, or null in free mode */
  guidedPropId: number | null
  onSelect: (propId: number) => void
  isMobile: boolean
}

// ── Sub-components ──────────────────────────────────────────────────

/** 48px square thumbnail button for the choosing phase */
function MacroThumbnailButton({
  propId,
  title,
  isGuided,
  isFocused,
  previewSrc,
  isMobile,
  onFocus,
  onSelect,
}: {
  propId: number
  title: string
  isGuided: boolean
  isFocused: boolean
  previewSrc: string | undefined
  isMobile: boolean
  onFocus: () => void
  onSelect: () => void
}) {
  const size = isMobile ? 44 : 48
  return (
    <button
      data-element="macro-thumbnail"
      data-prop-id={propId}
      title={`I.${propId} — ${title}`}
      onPointerDown={(e) => e.stopPropagation()}
      onPointerEnter={onFocus}
      onClick={() => {
        if (isFocused) {
          onSelect()
        } else {
          onFocus()
        }
      }}
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        border: isFocused
          ? `2px solid ${BYRNE.blue}`
          : isGuided
            ? `2px solid ${BYRNE.yellow}`
            : '1.5px solid rgba(203, 213, 225, 0.6)',
        background: isFocused
          ? 'rgba(78, 121, 167, 0.10)'
          : isGuided
            ? 'rgba(240, 199, 94, 0.10)'
            : 'rgba(252, 252, 248, 0.6)',
        cursor: 'pointer',
        padding: 0,
        position: 'relative',
        overflow: 'hidden',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'border-color 0.15s, background 0.15s',
        outline: 'none',
      }}
    >
      {/* Preview image or SVG fallback */}
      {previewSrc ? (
        <img
          src={previewSrc}
          alt={`I.${propId}`}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            opacity: 0.85,
          }}
        />
      ) : (
        <PropThumbnailStandalone propId={propId} size={size - 8} color="#94a3b8" />
      )}

      {/* "I.X" badge at bottom-left */}
      <span
        style={{
          position: 'absolute',
          bottom: 2,
          left: 2,
          fontSize: 9,
          fontWeight: 700,
          fontFamily: 'system-ui, sans-serif',
          color: '#fff',
          background: 'rgba(15, 23, 42, 0.7)',
          borderRadius: 4,
          padding: '0px 3px',
          lineHeight: '14px',
          letterSpacing: '0.04em',
        }}
      >
        I.{propId}
      </span>
    </button>
  )
}

/** Detail pane showing title + statement for the focused macro */
function MacroDetailPane({ propId }: { propId: number }) {
  const prop = getProposition(propId)
  if (!prop) return null
  return (
    <div
      data-element="macro-detail-pane"
      style={{
        borderTop: '1px solid rgba(203, 213, 225, 0.5)',
        paddingTop: 6,
        width: '100%',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 5,
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: BYRNE.blue,
            letterSpacing: '0.04em',
            flexShrink: 0,
          }}
        >
          I.{propId}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: '#1e293b',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {prop.title}
        </span>
      </div>
      <div
        style={{
          fontSize: 10,
          color: '#64748b',
          fontFamily: 'system-ui, sans-serif',
          lineHeight: 1.4,
          marginTop: 2,
        }}
      >
        {prop.statement}
      </div>
    </div>
  )
}

/** 28px circular dot for non-selected macros in the selecting phase */
function CollapsedMacroDot({
  propId,
  isGuided,
  onSelect,
}: {
  propId: number
  isGuided: boolean
  onSelect: () => void
}) {
  return (
    <button
      data-element="macro-dot"
      data-prop-id={propId}
      title={`Switch to I.${propId}`}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={onSelect}
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        border: isGuided ? `2px solid ${BYRNE.yellow}` : '1.5px solid rgba(203, 213, 225, 0.5)',
        background: 'rgba(252, 252, 248, 0.8)',
        cursor: 'pointer',
        padding: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'system-ui, sans-serif',
        color: '#64748b',
        flexShrink: 0,
        transition: 'border-color 0.15s',
        outline: 'none',
      }}
    >
      {propId}
    </button>
  )
}

/** Compact horizontal card for the selected macro in selecting phase */
function ExpandedMacroCard({
  propId,
  def,
  title,
  previewSrc,
  selectedCount,
  nextLabel,
}: {
  propId: number
  def: MacroDef
  title: string
  previewSrc: string | undefined
  selectedCount: number
  nextLabel: string | null
}) {
  return (
    <div
      data-element="macro-expanded-card"
      data-prop-id={propId}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 10px',
        borderRadius: 8,
        border: `1.5px solid ${BYRNE.blue}`,
        background: 'rgba(78, 121, 167, 0.10)',
        maxWidth: 240,
        boxShadow: '0 2px 8px rgba(78,121,167,0.15)',
      }}
    >
      {/* Small preview */}
      {previewSrc ? (
        <img
          src={previewSrc}
          alt={`I.${propId}`}
          style={{
            width: 40,
            height: 40,
            objectFit: 'contain',
            flexShrink: 0,
            borderRadius: 4,
          }}
        />
      ) : (
        <PropThumbnailStandalone propId={propId} size={36} color={BYRNE.blue} />
      )}

      {/* Text column */}
      <div style={{ minWidth: 0, flex: 1 }}>
        {/* Label + title row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            gap: 4,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: BYRNE.blue,
              fontFamily: 'system-ui, sans-serif',
              letterSpacing: '0.06em',
              flexShrink: 0,
            }}
          >
            I.{propId}
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#1e293b',
              fontFamily: 'system-ui, sans-serif',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {title}
          </span>
        </div>

        {/* Progress dots */}
        <div
          data-element="bound-dots"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            marginTop: 3,
          }}
        >
          {Array.from({ length: def.inputs.length }, (_, i) => (
            <div
              key={i}
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: i < selectedCount ? BYRNE_CYCLE[i % 3] : 'rgba(148, 163, 184, 0.25)',
                border: i < selectedCount ? 'none' : '1px solid rgba(148, 163, 184, 0.4)',
                transition: 'background 0.15s',
              }}
            />
          ))}
        </div>

        {/* Current input prompt */}
        {nextLabel && (
          <div
            style={{
              fontSize: 10,
              color: BYRNE_CYCLE[selectedCount % 3],
              fontFamily: 'system-ui, sans-serif',
              marginTop: 2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            <span style={{ opacity: 0.6 }}>
              {selectedCount}/{def.inputs.length}
            </span>{' '}
            Select {nextLabel} →
          </div>
        )}
        {!nextLabel && (
          <div
            style={{
              fontSize: 10,
              color: '#10b981',
              fontFamily: 'system-ui, sans-serif',
              marginTop: 2,
            }}
          >
            All points selected
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────────

/**
 * Floating proposition picker that appears when the Macro tool is active.
 * Compact design that scales from 2 to 14+ macros:
 * - Choosing phase: grid of thumbnail buttons
 * - Selecting phase: collapsed dots + one expanded card
 */
export function MacroToolPanel({
  macros,
  macroPhase,
  guidedPropId,
  onSelect,
  isMobile,
}: MacroToolPanelProps) {
  const selectedPropId = macroPhase.tag === 'selecting' ? macroPhase.propId : null
  const propPreviews = usePropPreviews()
  const isChoosing = macroPhase.tag === 'choosing'

  // Focused thumbnail in choosing phase (for detail pane)
  const [focusedPropId, setFocusedPropId] = useState<number | null>(
    () => guidedPropId ?? macros[0]?.propId ?? null
  )

  // Selecting phase: compute progress for the expanded card
  const selectedCount = macroPhase.tag === 'selecting' ? macroPhase.selectedPointIds.length : 0
  const nextLabel =
    macroPhase.tag === 'selecting' ? (macroPhase.inputs[selectedCount]?.label ?? null) : null

  // Wrap threshold: form a grid when many macros
  const wrapThreshold = isMobile ? 6 : 8

  return (
    <div
      data-component="macro-tool-panel"
      style={{
        position: 'absolute',
        ...(isMobile
          ? {
              right: 68,
              top: '50%',
              transform: 'translateY(-50%)',
            }
          : {
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
            }),
        // Frosted glass container
        background: 'rgba(252, 252, 248, 0.92)',
        border: '1px solid rgba(203, 213, 225, 0.6)',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
        padding: 6,
        zIndex: 20,
        pointerEvents: 'auto',
        // Layout: column for choosing (thumbnails + detail pane), row/wrap for selecting
        display: 'flex',
        ...(isChoosing
          ? {
              flexDirection: 'column' as const,
              gap: 6,
              ...(isMobile ? { maxWidth: 220 } : { maxWidth: 280 }),
            }
          : {
              flexWrap: macros.length > wrapThreshold ? 'wrap' : ('nowrap' as const),
              gap: 6,
              ...(isMobile
                ? {
                    flexDirection: 'column' as const,
                    maxHeight: macros.length > wrapThreshold ? 220 : undefined,
                    alignItems: 'center' as const,
                  }
                : {
                    flexDirection: 'row' as const,
                    maxWidth: macros.length > wrapThreshold ? 280 : undefined,
                    alignItems: 'center' as const,
                  }),
            }),
      }}
    >
      {isChoosing ? (
        // ── Choosing phase: thumbnail grid + detail pane ──
        <>
          <div
            data-element="macro-thumbnail-grid"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 6,
            }}
          >
            {macros.map(({ propId, title }) => (
              <MacroThumbnailButton
                key={propId}
                propId={propId}
                title={title}
                isGuided={guidedPropId === propId}
                isFocused={focusedPropId === propId}
                previewSrc={propPreviews.get(propId)}
                isMobile={isMobile}
                onFocus={() => setFocusedPropId(propId)}
                onSelect={() => onSelect(propId)}
              />
            ))}
          </div>
          {focusedPropId != null && <MacroDetailPane propId={focusedPropId} />}
        </>
      ) : (
        // ── Selecting phase: dots + expanded card ──
        macros.map(({ propId, def, title }) => {
          if (propId === selectedPropId) {
            return (
              <ExpandedMacroCard
                key={propId}
                propId={propId}
                def={def}
                title={title}
                previewSrc={propPreviews.get(propId)}
                selectedCount={selectedCount}
                nextLabel={nextLabel}
              />
            )
          }
          // Only show dots if there are multiple macros
          if (macros.length <= 1) return null
          return (
            <CollapsedMacroDot
              key={propId}
              propId={propId}
              isGuided={guidedPropId === propId}
              onSelect={() => onSelect(propId)}
            />
          )
        })
      )}
    </div>
  )
}
