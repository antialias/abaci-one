'use client'

/**
 * Euclid-specific chat panel — thin wrapper around CharacterChatPanel.
 *
 * Wires in Euclid's character definition and geometric entity markers.
 */

import React from 'react'
import { CharacterChatPanel } from '@/lib/character/CharacterChatPanel'
import type { DebugCompactionProps } from '@/lib/character/CharacterChatPanel'
import type { ChatMessage, ChatCallState } from '@/lib/character/types'
import type { EuclidEntityRef } from './parseGeometricEntities'
import { EUCLID_CHARACTER_DEF } from '../euclidCharacterDef'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'

interface EuclidChatPanelProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (text: string) => void
  onClose: () => void
  onHighlight: (entity: EuclidEntityRef | null) => void
  renderEntity?: (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode
  /** Drag handlers for the header — when provided, header becomes drag handle */
  onDragPointerDown?: (e: React.PointerEvent) => void
  onDragPointerMove?: (e: React.PointerEvent) => void
  onDragPointerUp?: (e: React.PointerEvent) => void
  isDragging?: boolean
  /** Square off the bottom-right corner to connect with the quad */
  squareBottomRight?: boolean
  /** When set, shows compaction controls between messages (debug mode) */
  debugCompaction?: DebugCompactionProps
  /** When set, the chat panel acts as the voice call UI */
  callState?: ChatCallState
}

export function EuclidChatPanel({
  messages,
  isStreaming,
  onSend,
  onClose,
  onHighlight,
  renderEntity,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  isDragging,
  squareBottomRight,
  debugCompaction,
  callState,
}: EuclidChatPanelProps) {
  return (
    <CharacterChatPanel
      character={EUCLID_CHARACTER_DEF}
      entityMarkers={EUCLID_ENTITY_MARKERS}
      messages={messages}
      isStreaming={isStreaming}
      onSend={onSend}
      onClose={onClose}
      onHighlight={onHighlight}
      renderEntity={renderEntity}
      onDragPointerDown={onDragPointerDown}
      onDragPointerMove={onDragPointerMove}
      onDragPointerUp={onDragPointerUp}
      isDragging={isDragging}
      squareBottomRight={squareBottomRight}
      debugCompaction={debugCompaction}
      callState={callState}
    />
  )
}
