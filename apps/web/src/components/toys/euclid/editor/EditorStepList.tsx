'use client'

import { useState, useRef, useEffect } from 'react'
import type { SerializedStep } from '../types'
import type { ProofFact } from '../engine/facts'
import { isAngleFact } from '../engine/facts'
import { CITATIONS, citationDefFromFact } from '../engine/citations'

interface EditorStepListProps {
  steps: SerializedStep[]
  proofFacts: ProofFact[]
  onUpdateInstruction: (index: number, instruction: string) => void
  onUpdateNotes: (index: number, notes: string) => void
  onDeleteLast: () => void
  onRewind: (targetStep: number) => void
}

export function EditorStepList({
  steps,
  proofFacts,
  onUpdateInstruction,
  onUpdateNotes,
  onDeleteLast,
  onRewind,
}: EditorStepListProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editingNotesIndex, setEditingNotesIndex] = useState<number | null>(null)
  const [hoveredStepIndex, setHoveredStepIndex] = useState<number | null>(null)

  // Group proof facts by step
  const factsByStep = new Map<number, ProofFact[]>()
  for (const fact of proofFacts) {
    const existing = factsByStep.get(fact.atStep) ?? []
    existing.push(fact)
    factsByStep.set(fact.atStep, existing)
  }

  // Scroll to bottom when steps change
  useEffect(() => {
    const container = scrollRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [steps.length])

  if (steps.length === 0) {
    return (
      <div
        data-element="editor-step-list"
        style={{
          flex: 1,
          minHeight: 0,
          padding: '16px 20px',
          color: '#94a3b8',
          fontSize: 13,
          fontFamily: 'Georgia, serif',
          fontStyle: 'italic',
        }}
      >
        Select a citation above, then perform an action on the canvas.
      </div>
    )
  }

  return (
    <div
      data-element="editor-step-list"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header with delete button */}
      <div
        style={{
          padding: '8px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          Steps ({steps.length})
        </span>
        <button
          data-action="delete-last-step"
          onClick={onDeleteLast}
          style={{
            padding: '3px 8px',
            borderRadius: 4,
            border: '1px solid rgba(239, 68, 68, 0.3)',
            background: 'rgba(239, 68, 68, 0.06)',
            color: '#ef4444',
            fontSize: 10,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          Undo last
        </button>
      </div>

      {/* Scrollable step list */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '0 20px 12px',
        }}
      >
        {steps.map((step, i) => {
          const stepFacts = factsByStep.get(i) ?? []
          const isHovered = hoveredStepIndex === i
          const citDef = CITATIONS[step.citation]

          return (
            <div
              key={i}
              data-element="editor-step"
              onClick={() => onRewind(i)}
              onMouseEnter={() => setHoveredStepIndex(i)}
              onMouseLeave={() => setHoveredStepIndex(null)}
              style={{
                marginBottom: 12,
                cursor: 'pointer',
                borderRadius: 6,
                background: isHovered ? 'rgba(78, 121, 167, 0.04)' : undefined,
                transition: 'background 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                {/* Step indicator */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    flexShrink: 0,
                    marginTop: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: 'system-ui, sans-serif',
                    background: isHovered ? '#0d9668' : '#10b981',
                    color: '#fff',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isHovered ? '\u21BA' : '\u2713'}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Instruction (editable) */}
                  {editingIndex === i ? (
                    <input
                      data-element="edit-instruction"
                      defaultValue={step.instruction}
                      onBlur={(e) => {
                        onUpdateInstruction(i, e.target.value)
                        setEditingIndex(null)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdateInstruction(i, (e.target as HTMLInputElement).value)
                          setEditingIndex(null)
                        }
                        if (e.key === 'Escape') setEditingIndex(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      style={{
                        width: '100%',
                        padding: '2px 6px',
                        borderRadius: 4,
                        border: '1px solid #4E79A7',
                        fontSize: 13,
                        fontFamily: 'Georgia, serif',
                        outline: 'none',
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setEditingIndex(i)
                      }}
                      style={{
                        fontSize: 13,
                        fontWeight: 400,
                        color: '#475569',
                        fontFamily: 'Georgia, serif',
                        lineHeight: 1.4,
                      }}
                    >
                      {step.instruction}
                    </div>
                  )}

                  {/* Citation badge */}
                  <div
                    style={{
                      marginTop: 3,
                      fontSize: 10,
                      fontWeight: 600,
                      color: '#6b9b6b',
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    [{step.citation}]
                    {citDef && (
                      <span
                        style={{
                          fontWeight: 400,
                          fontStyle: 'italic',
                          fontFamily: 'Georgia, serif',
                          color: '#94a3b8',
                          marginLeft: 4,
                        }}
                      >
                        {citDef.text}
                      </span>
                    )}
                  </div>

                  {/* Action type indicator */}
                  <div
                    style={{
                      marginTop: 2,
                      fontSize: 10,
                      color: '#94a3b8',
                      fontFamily: 'system-ui, sans-serif',
                    }}
                  >
                    {step.action.type === 'compass' &&
                      `Compass: ${step.action.centerId} → ${step.action.radiusPointId}`}
                    {step.action.type === 'straightedge' &&
                      `Straightedge: ${step.action.fromId} → ${step.action.toId}`}
                    {step.action.type === 'intersection' &&
                      `Intersection: ${step.action.label} (${step.action.ofA} ∩ ${step.action.ofB})`}
                    {step.action.type === 'macro' &&
                      `Macro: I.${step.action.propId}(${step.action.inputPointIds.join(', ')})`}
                    {step.action.type === 'fact-only' && 'Fact annotation'}
                  </div>

                  {/* Step facts */}
                  {stepFacts.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      {stepFacts.map((fact) => (
                        <div
                          key={fact.id}
                          style={{
                            fontSize: 11,
                            marginBottom: 2,
                            paddingLeft: 8,
                            borderLeft: '2px solid rgba(78, 121, 167, 0.2)',
                          }}
                        >
                          <span
                            style={{
                              color: '#4E79A7',
                              fontWeight: 600,
                              fontFamily: 'Georgia, serif',
                            }}
                          >
                            {fact.statement}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes (editable) */}
                  {editingNotesIndex === i ? (
                    <textarea
                      data-element="edit-notes"
                      defaultValue={step.notes ?? ''}
                      onBlur={(e) => {
                        onUpdateNotes(i, e.target.value)
                        setEditingNotesIndex(null)
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      placeholder="Handoff notes for Claude..."
                      style={{
                        width: '100%',
                        minHeight: 32,
                        marginTop: 4,
                        padding: '4px 8px',
                        borderRadius: 4,
                        border: '1px solid rgba(203, 213, 225, 0.5)',
                        fontSize: 11,
                        fontFamily: 'system-ui, sans-serif',
                        outline: 'none',
                        resize: 'vertical',
                      }}
                    />
                  ) : (
                    <div
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        setEditingNotesIndex(i)
                      }}
                      style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: step.notes ? '#64748b' : '#c0c6cc',
                        fontFamily: 'system-ui, sans-serif',
                        fontStyle: 'italic',
                        cursor: 'text',
                      }}
                    >
                      {step.notes || 'Double-click to add notes...'}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
