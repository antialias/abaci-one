'use client'

import { BYRNE, BYRNE_CYCLE } from './types'
import type { MacroPhase } from './types'
import type { MacroDef } from './engine/macros'
import { PropThumbnailStandalone } from './render/PropThumbnailSvg'

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

/**
 * Floating proposition picker that appears when the Macro tool is active.
 * Shows all available prior propositions as selectable cards.
 * In guided mode, the required proposition is highlighted.
 */
export function MacroToolPanel({
  macros,
  macroPhase,
  guidedPropId,
  onSelect,
  isMobile,
}: MacroToolPanelProps) {
  const selectedPropId = macroPhase.tag === 'selecting' ? macroPhase.propId : null

  console.log(
    '[macro-debug] MacroToolPanel render macros=%d phase=%s isMobile=%s',
    macros.length,
    macroPhase.tag,
    isMobile
  )

  return (
    <div
      data-component="macro-tool-panel"
      style={{
        position: 'absolute',
        ...(isMobile
          ? {
              // Mobile: tool dock is vertical on right — panel appears to its left
              right: 68,
              top: '50%',
              transform: 'translateY(-50%)',
              flexDirection: 'column',
            }
          : {
              // Desktop: tool dock is horizontal at bottom — panel appears above it
              bottom: 80,
              left: '50%',
              transform: 'translateX(-50%)',
              flexDirection: 'row',
            }),
        display: 'flex',
        gap: 8,
        zIndex: 20,
        pointerEvents: 'auto',
      }}
    >
      {macros.map(({ propId, def, title }) => {
        const isSelected = selectedPropId === propId
        const isGuided = guidedPropId === propId
        const isChoosing = macroPhase.tag === 'choosing'

        // Selection progress: how many points have been selected
        const selectedCount =
          isSelected && macroPhase.tag === 'selecting' ? macroPhase.selectedPointIds.length : 0
        const nextLabel =
          isSelected && macroPhase.tag === 'selecting'
            ? (macroPhase.inputLabels[selectedCount] ?? null)
            : null

        const borderColor = isSelected
          ? BYRNE.blue
          : isGuided && isChoosing
            ? BYRNE.yellow
            : 'rgba(203, 213, 225, 0.6)'

        const bg = isSelected
          ? 'rgba(78, 121, 167, 0.12)'
          : isGuided && isChoosing
            ? 'rgba(240, 199, 94, 0.10)'
            : 'rgba(252, 252, 248, 0.92)'

        return (
          <button
            key={propId}
            data-element="macro-prop-card"
            data-prop-id={propId}
            onPointerDown={(e) => {
              e.stopPropagation()
            }}
            onClick={() => {
              onSelect(propId)
            }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 2,
              padding: '8px 12px',
              borderRadius: 10,
              border: `1.5px solid ${borderColor}`,
              background: bg,
              cursor: 'pointer',
              minWidth: 140,
              textAlign: 'left',
              boxShadow: isSelected
                ? '0 2px 8px rgba(78,121,167,0.18)'
                : '0 1px 4px rgba(15,23,42,0.08)',
              transition: 'border-color 0.15s, background 0.15s',
              outline: 'none',
            }}
          >
            {/* Prop identifier badge + thumbnail */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                width: '100%',
              }}
            >
              <PropThumbnailStandalone
                propId={propId}
                size={28}
                color={isSelected ? BYRNE.blue : '#94a3b8'}
              />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.06em',
                  color: isSelected ? BYRNE.blue : '#64748b',
                  fontFamily: 'system-ui, sans-serif',
                  textTransform: 'uppercase',
                }}
              >
                I.{propId}
              </span>
              {isGuided && isChoosing && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: '#92670a',
                    background: 'rgba(240, 199, 94, 0.25)',
                    borderRadius: 4,
                    padding: '1px 5px',
                    fontFamily: 'system-ui, sans-serif',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  required
                </span>
              )}
            </div>

            {/* Title */}
            <div
              style={{
                fontSize: 12,
                fontWeight: isSelected ? 600 : 500,
                color: isSelected ? '#1e293b' : '#334155',
                fontFamily: 'system-ui, sans-serif',
                lineHeight: 1.3,
              }}
            >
              {title}
            </div>

            {/* Bound dots — visual checklist of already-selected inputs */}
            {isSelected && selectedCount > 0 && (
              <div
                data-element="bound-dots"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginTop: 2,
                }}
              >
                {Array.from({ length: def.inputCount }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background:
                        i < selectedCount ? BYRNE_CYCLE[i % 3] : 'rgba(148, 163, 184, 0.25)',
                      border: i < selectedCount ? 'none' : '1px solid rgba(148, 163, 184, 0.4)',
                      transition: 'background 0.15s',
                    }}
                  />
                ))}
              </div>
            )}

            {/* Point selection prompt (when this prop is selected and awaiting input) */}
            {isSelected && nextLabel && (
              <div
                style={{
                  fontSize: 11,
                  color: BYRNE_CYCLE[selectedCount % 3],
                  fontFamily: 'system-ui, sans-serif',
                  marginTop: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <span style={{ opacity: 0.6 }}>
                  {selectedCount}/{def.inputCount}
                </span>{' '}
                Select {nextLabel} →
              </div>
            )}
            {isSelected && !nextLabel && macroPhase.tag === 'selecting' && (
              <div
                style={{
                  fontSize: 11,
                  color: '#10b981',
                  fontFamily: 'system-ui, sans-serif',
                  marginTop: 2,
                }}
              >
                All points selected
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}
