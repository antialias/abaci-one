'use client'

/**
 * Construction Log panel for playground mode.
 *
 * Shows a running list of construction actions with postulate/proposition
 * citations and entity-marked descriptions. Users can edit descriptions,
 * which are re-annotated via the markup API.
 */

import type React from 'react'
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { ConstructionState, ConstructionElement } from '../types'
import type { PostCompletionAction } from '../engine/replayConstruction'
import type { ProofFact } from '../engine/facts'
import type { EuclidEntityRef } from '../chat/parseGeometricEntities'
import type { ConstructionEventBus } from '../agent/ConstructionEventBus'
import type { LedgerEntryDescriptor } from './describeAction'
import { describeAction, describeGivenElement } from './describeAction'
import { LedgerEntry } from './LedgerEntry'
import { LedgerPreviewEntry } from './LedgerPreviewEntry'
import { FactRow } from '../proof/FactRow'
import { citationDefFromFact } from '../engine/citations'
import { SECTION_LABEL_STYLE, EMPTY_STATE_STYLE, getProofFontSizes } from '../proof/styles'

interface ProofLedgerProps {
  constructionState: ConstructionState
  actions: PostCompletionAction[]
  givenElements: ConstructionElement[]
  proofFacts: ProofFact[]
  eventBus: ConstructionEventBus
  pointLabels: string[]
  renderEntity: (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode
  onRevertToAction?: (actionIndex: number) => void
  onCitationPointerEnter?: (key: string, e: React.PointerEvent) => void
  onCitationPointerLeave?: () => void
  onCitationPointerDown?: (key: string, e: React.PointerEvent) => void
  toolPreview?: LedgerEntryDescriptor | null
  isMobile: boolean
}

export function ProofLedger({
  constructionState,
  actions,
  givenElements,
  proofFacts,
  eventBus,
  pointLabels,
  renderEntity,
  onRevertToAction,
  onCitationPointerEnter,
  onCitationPointerLeave,
  onCitationPointerDown,
  toolPreview,
  isMobile,
}: ProofLedgerProps) {
  const [editedDescriptions, setEditedDescriptions] = useState<Map<number, string>>(new Map())
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [markupLoadingIndex, setMarkupLoadingIndex] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Internal version counter driven by event bus subscription.
  // This localizes re-renders to ProofLedger instead of the entire canvas.
  const [ledgerVersion, setLedgerVersion] = useState(0)
  const prevVersionRef = useRef(0)

  useEffect(() => {
    return eventBus.subscribe((event) => {
      if (event.reset) {
        setLedgerVersion(0)
        setEditedDescriptions(new Map())
        setEditingIndex(null)
        setMarkupLoadingIndex(null)
      } else {
        setLedgerVersion((v) => v + 1)
      }
    })
  }, [eventBus])

  // Derive given entries
  const givenEntries = useMemo(
    () => givenElements.map((el) => describeGivenElement(el)),
    [givenElements]
  )

  // Derive action entries, re-derive when ledgerVersion changes
  const actionEntries = useMemo(
    () =>
      actions.map((action, i) => {
        const edited = editedDescriptions.get(i)
        const derived = describeAction(action, constructionState)
        return {
          citation: derived.citation,
          markedDescription: edited ?? derived.markedDescription,
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ledgerVersion, editedDescriptions]
  )

  // Progressive disclosure ordinals: track how many times each citation key appears
  const citationOrdinals = useMemo(() => {
    const counts = new Map<string, number>()
    return actionEntries.map((entry) => {
      if (!entry.citation) return 1
      const n = (counts.get(entry.citation) ?? 0) + 1
      counts.set(entry.citation, n)
      return n
    })
  }, [actionEntries])

  // Auto-scroll to bottom on new entries or preview changes
  useEffect(() => {
    if (ledgerVersion > prevVersionRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevVersionRef.current = ledgerVersion
  }, [ledgerVersion])

  useEffect(() => {
    if (toolPreview && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [toolPreview])

  const handleStartEdit = useCallback((index: number) => {
    setEditingIndex(index)
  }, [])

  const handleCancelEdit = useCallback(() => {
    setEditingIndex(null)
  }, [])

  const handleCommitEdit = useCallback(
    async (index: number, text: string) => {
      setEditingIndex(null)

      // Skip if text hasn't changed meaningfully
      const current = actionEntries[index]?.markedDescription
      if (!current) return

      setMarkupLoadingIndex(index)
      try {
        const res = await fetch('/api/realtime/euclid/markup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, pointLabels, strict: true }),
        })
        if (res.ok) {
          const { markedText } = await res.json()
          setEditedDescriptions((prev) => {
            const next = new Map(prev)
            next.set(index, markedText)
            return next
          })
        }
      } catch {
        // On error, store the plain text as-is (no markers)
        setEditedDescriptions((prev) => {
          const next = new Map(prev)
          next.set(index, text)
          return next
        })
      } finally {
        setMarkupLoadingIndex(null)
      }
    },
    [actionEntries, pointLabels]
  )

  const hasEntries = givenEntries.length > 0 || actionEntries.length > 0

  return (
    <div
      data-component="proof-ledger"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Header */}
      <div
        data-element="ledger-header"
        style={{
          padding: isMobile ? '8px 16px' : '12px 20px',
          borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
        }}
      >
        <span style={SECTION_LABEL_STYLE}>Construction Log</span>
      </div>

      {/* Scrollable entries */}
      <div
        ref={scrollRef}
        data-element="ledger-entries"
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: isMobile ? '8px 16px 12px' : '8px 20px 12px',
        }}
      >
        {!hasEntries && <p style={EMPTY_STATE_STYLE}>Use the tools to begin constructing.</p>}

        {/* Given elements */}
        {givenEntries.map((entry, i) => (
          <LedgerEntry
            key={`given-${i}`}
            index={i}
            citation={entry.citation}
            markedDescription={entry.markedDescription}
            isEditing={false}
            isLoadingMarkup={false}
            onStartEdit={() => {}}
            onCommitEdit={() => {}}
            onCancelEdit={() => {}}
            renderEntity={renderEntity}
            isGiven
            isMobile={isMobile}
          />
        ))}

        {/* Divider between given and actions */}
        {givenEntries.length > 0 && actionEntries.length > 0 && (
          <div
            style={{
              borderTop: '1px solid rgba(203, 213, 225, 0.3)',
              margin: '6px 0',
            }}
          />
        )}

        {/* Action entries */}
        {actionEntries.map((entry, i) => (
          <LedgerEntry
            key={`action-${i}`}
            index={i}
            stepNumber={i + 1}
            citation={entry.citation}
            citationOrdinal={citationOrdinals[i]}
            markedDescription={entry.markedDescription}
            isEditing={editingIndex === i}
            isLoadingMarkup={markupLoadingIndex === i}
            onStartEdit={() => handleStartEdit(i)}
            onCommitEdit={(text) => handleCommitEdit(i, text)}
            onCancelEdit={handleCancelEdit}
            onRevert={onRevertToAction ? () => onRevertToAction(i) : undefined}
            renderEntity={renderEntity}
            onCitationPointerEnter={onCitationPointerEnter}
            onCitationPointerLeave={onCitationPointerLeave}
            onCitationPointerDown={onCitationPointerDown}
            isMobile={isMobile}
          />
        ))}

        {/* Proof facts (declared equalities) */}
        {proofFacts.length > 0 && (
          <>
            <div
              style={{
                borderTop: '1px solid rgba(203, 213, 225, 0.3)',
                margin: '6px 0',
              }}
            />
            <div style={{ ...SECTION_LABEL_STYLE, marginBottom: 4 }}>Proof Facts</div>
            {proofFacts.map((fact) => {
              const citDef = citationDefFromFact(fact.citation)
              const explanation = fact.justification.replace(/^(Def\.15|C\.N\.\d|I\.\d+):\s*/, '')
              return (
                <FactRow
                  key={fact.id}
                  fact={fact}
                  citation={
                    citDef
                      ? {
                          def: citDef,
                          label: citDef.label,
                          showText: false,
                          onPointerEnter: onCitationPointerEnter,
                          onPointerLeave: onCitationPointerLeave,
                          onPointerDown: onCitationPointerDown,
                        }
                      : undefined
                  }
                  explanation={explanation}
                  fontSize={getProofFontSizes(isMobile).stepText}
                />
              )
            })}
          </>
        )}

        {/* In-progress tool preview */}
        {toolPreview && (
          <LedgerPreviewEntry
            citation={toolPreview.citation}
            markedDescription={toolPreview.markedDescription}
            stepNumber={actionEntries.length + 1}
            renderEntity={renderEntity}
            isMobile={isMobile}
          />
        )}
      </div>
    </div>
  )
}
