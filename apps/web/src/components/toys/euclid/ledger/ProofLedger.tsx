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
import type { EuclidEntityRef } from '../chat/parseGeometricEntities'
import type { ConstructionEventBus } from '../voice/ConstructionEventBus'
import { describeAction, describeGivenElement } from './describeAction'
import { LedgerEntry } from './LedgerEntry'

interface ProofLedgerProps {
  constructionState: ConstructionState
  actions: PostCompletionAction[]
  givenElements: ConstructionElement[]
  eventBus: ConstructionEventBus
  pointLabels: string[]
  renderEntity: (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode
  isMobile: boolean
}

export function ProofLedger({
  constructionState,
  actions,
  givenElements,
  eventBus,
  pointLabels,
  renderEntity,
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

  // Auto-scroll to bottom on new entries
  useEffect(() => {
    if (ledgerVersion > prevVersionRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
    prevVersionRef.current = ledgerVersion
  }, [ledgerVersion])

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
          Construction Log
        </span>
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
        {!hasEntries && (
          <p
            style={{
              fontSize: 13,
              fontFamily: 'Georgia, serif',
              fontStyle: 'italic',
              color: '#94a3b8',
              margin: '8px 0',
            }}
          >
            Use the tools to begin constructing.
          </p>
        )}

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
            citation={entry.citation}
            markedDescription={entry.markedDescription}
            isEditing={editingIndex === i}
            isLoadingMarkup={markupLoadingIndex === i}
            onStartEdit={() => handleStartEdit(i)}
            onCommitEdit={(text) => handleCommitEdit(i, text)}
            onCancelEdit={handleCancelEdit}
            renderEntity={renderEntity}
          />
        ))}
      </div>
    </div>
  )
}
