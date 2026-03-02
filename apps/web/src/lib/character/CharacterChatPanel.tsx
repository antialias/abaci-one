'use client'

/**
 * Generic floating glassmorphism chat panel for character conversations.
 *
 * Parameterized on character identity (name, image, strings) and an optional
 * entity marker system for domain-specific inline highlights.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { CharacterDefinition, ChatMessage, ChatCallState, EntityMarkerConfig } from './types'
import { MarkedText } from './MarkedText'
import { CallStatusChip } from './CallStatusChip'

export interface DebugCompactionProps {
  /** Current compaction coverage (messages 0..coversUpTo are summarized) */
  coversUpTo: number
  /** Whether a summarization request is in-flight */
  isSummarizing: boolean
  /** Trigger compaction of all messages before the given message index */
  onCompactUpTo: (index: number) => void
}

export interface CharacterChatPanelProps<TEntityRef> {
  character: CharacterDefinition
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (text: string) => void
  onClose: () => void
  entityMarkers?: EntityMarkerConfig<TEntityRef>
  onHighlight?: (entity: TEntityRef | null) => void
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

export function CharacterChatPanel<TEntityRef>({
  character,
  messages,
  isStreaming,
  onSend,
  onClose,
  entityMarkers,
  onHighlight,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  isDragging,
  squareBottomRight,
  debugCompaction,
  callState,
}: CharacterChatPanelProps<TEntityRef>) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const userScrolledAwayRef = useRef(false)
  const programmaticScrollRef = useRef(false)

  // Track whether the user has scrolled away from the bottom.
  // Ignore scroll events caused by our own programmatic scrolling.
  const handleMessagesScroll = useCallback(() => {
    if (programmaticScrollRef.current) return
    const el = messagesContainerRef.current
    if (!el) return
    const threshold = 40
    const nearBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight < threshold
    userScrolledAwayRef.current = !nearBottom
  }, [])

  // Auto-scroll only when the user hasn't scrolled away
  useEffect(() => {
    if (!userScrolledAwayRef.current) {
      const el = messagesContainerRef.current
      if (el) {
        programmaticScrollRef.current = true
        el.scrollTop = el.scrollHeight
        requestAnimationFrame(() => {
          programmaticScrollRef.current = false
        })
      }
    }
  }, [messages])

  // Focus input on open
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return
    onSend(input.trim())
    setInput('')
  }, [input, isStreaming, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend],
  )

  const hasDragHandlers = !!onDragPointerDown
  const headerName = character.nativeDisplayName ?? character.displayName

  // Call-aware derived state
  const isCallActive = callState?.state === 'ringing' || callState?.state === 'active'
  const isRinging = callState?.state === 'ringing'
  const isCallError = callState?.state === 'error'
  const dangerColor = '#ef4444'
  const accentColor = '#7c3aed'

  return (
    <div
      data-component="character-chat-panel"
      style={{
        width: 'min(300px, calc(100vw - 24px))',
        maxHeight: 'min(420px, calc(100vh - 120px))',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: squareBottomRight ? '12px 12px 0 12px' : 12,
        border: '1px solid rgba(203, 213, 225, 0.8)',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header — drag handle when drag props provided, transforms during call */}
      <div
        data-element="chat-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid rgba(203, 213, 225, 0.5)',
          background: 'rgba(248, 250, 252, 0.8)',
          flexShrink: 0,
          cursor: hasDragHandlers ? (isDragging ? 'grabbing' : 'grab') : undefined,
          touchAction: hasDragHandlers ? 'none' : undefined,
          userSelect: hasDragHandlers ? 'none' : undefined,
        }}
        onPointerDown={onDragPointerDown}
        onPointerMove={onDragPointerMove}
        onPointerUp={onDragPointerUp}
        onPointerCancel={onDragPointerUp}
      >
        {/* Left: cross-fade between idle avatar+name and call status chip */}
        <div style={{ display: 'grid', alignItems: 'center', minWidth: 0 }}>
          {callState && (
            <div style={{ gridRow: 1, gridColumn: 1 }}>
              <CallStatusChip character={character} callState={callState} size="standard" />
            </div>
          )}
          <div style={{
            gridRow: 1, gridColumn: 1,
            display: 'flex', alignItems: 'center', gap: 8,
            opacity: isCallActive ? 0 : 1,
            transition: 'opacity 0.25s ease',
            pointerEvents: isCallActive ? 'none' : 'auto',
          }}>
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                overflow: 'hidden',
                flexShrink: 0,
              }}
            >
              <img
                src={character.profileImage}
                alt={character.displayName}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
            <span style={{ fontWeight: 600, fontSize: 13, color: '#1e293b' }}>{headerName}</span>
          </div>
        </div>
        {/* Right: × close button (always visible — panel-level control) */}
        <button
          data-action="close-chat"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={onClose}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            color: '#94a3b8',
            fontSize: 18,
            lineHeight: 1,
            padding: '2px 4px',
            borderRadius: 4,
          }}
          title="Close chat"
        >
          {'\u2715'}
        </button>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        data-element="chat-messages"
        onScroll={handleMessagesScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 0,
          userSelect: 'text',
          WebkitUserSelect: 'text',
          position: 'relative',
        }}
      >
        {/* Error banner at top of messages area */}
        {isCallError && callState && (
          <div
            data-element="call-error-banner"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: 'rgba(254, 242, 242, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 12,
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 4 }}>
              Couldn&apos;t connect
            </div>
            <div style={{ color: '#6b7280', marginBottom: 8, lineHeight: 1.4 }}>
              {callState.error || 'Something went wrong'}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
              {callState.errorCode !== 'quota_exceeded' && (
                <button
                  data-action="retry-call"
                  onClick={callState.onRetry}
                  style={{
                    border: 'none',
                    background: accentColor,
                    color: '#fff',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '4px 14px',
                    borderRadius: 10,
                    cursor: 'pointer',
                  }}
                >
                  Try Again
                </button>
              )}
              <button
                data-action="dismiss-error"
                onClick={callState.onHangUp}
                style={{
                  border: 'none',
                  background: 'rgba(0,0,0,0.06)',
                  color: '#374151',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
        {messages.length === 0 && (
          <div
            style={{
              color: '#94a3b8',
              fontSize: 12,
              textAlign: 'center',
              padding: '24px 12px',
              fontStyle: 'italic',
            }}
          >
            {character.chat.emptyPrompt}
          </div>
        )}
        {messages.map((msg, msgIndex) => {
          // Debug compaction divider — shown between messages when debug is active
          const compactionDivider = debugCompaction && msgIndex > 0 ? (() => {
            const isCovered = msgIndex <= debugCompaction.coversUpTo
            const isAtBoundary = msgIndex === debugCompaction.coversUpTo
            const canCompact = !debugCompaction.isSummarizing && msgIndex > debugCompaction.coversUpTo
            return (
              <div
                key={`compact-${msgIndex}`}
                data-element="compaction-divider"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '1px 0',
                  opacity: isCovered ? 0.4 : 0.7,
                }}
              >
                <div style={{ flex: 1, height: 1, background: isAtBoundary ? '#86efac' : isCovered ? '#86efac' : 'rgba(203,213,225,0.4)' }} />
                {isAtBoundary ? (
                  <span style={{ fontSize: 8, color: '#86efac', whiteSpace: 'nowrap' }}>
                    summarized above
                  </span>
                ) : canCompact ? (
                  <button
                    data-action="compact-here"
                    onClick={() => debugCompaction.onCompactUpTo(msgIndex)}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: 'pointer',
                      fontSize: 9,
                      color: '#94a3b8',
                      padding: '0 4px',
                      whiteSpace: 'nowrap',
                    }}
                    title={`Compact messages 1–${msgIndex} into a summary`}
                  >
                    {'\u2702'} compact here
                  </button>
                ) : null}
                <div style={{ flex: 1, height: 1, background: isAtBoundary ? '#86efac' : isCovered ? '#86efac' : 'rgba(203,213,225,0.4)' }} />
              </div>
            )
          })() : null

          // Event messages render as small centered notices
          if (msg.isEvent) {
            return (
              <React.Fragment key={msg.id}>
                {compactionDivider}
                <div
                  data-element="chat-message-event"
                  style={{
                    textAlign: 'center',
                    padding: '4px 12px',
                    fontSize: 11,
                    color: '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                    {msg.content}
                  </div>
                  {msg.imageDataUrl && (
                    <img
                      src={msg.imageDataUrl}
                      alt="Construction screenshot"
                      data-element="event-screenshot"
                      style={{
                        width: 120,
                        height: 90,
                        objectFit: 'cover',
                        borderRadius: 6,
                        border: '1px solid rgba(203, 213, 225, 0.6)',
                        opacity: 0.85,
                      }}
                    />
                  )}
                </div>
              </React.Fragment>
            )
          }
          // Error messages render as centered system notices, not character speech
          if (msg.isError) {
            return (
              <React.Fragment key={msg.id}>
                {compactionDivider}
                <div
                  data-element="chat-message-error"
                  style={{
                    textAlign: 'center',
                    padding: '8px 12px',
                    fontSize: 12,
                    color: '#94a3b8',
                    fontStyle: 'italic',
                  }}
                >
                  {msg.content}
                </div>
              </React.Fragment>
            )
          }
          return (
            <React.Fragment key={msg.id}>
              {compactionDivider}
              <div
                data-element={`chat-message-${msg.role}`}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-start',
                  gap: 6,
                }}
              >
              {msg.role === 'assistant' && (
                <img
                  src={character.profileImage}
                  alt=""
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                />
              )}
              <div
                style={{
                  maxWidth: '85%',
                  padding: '6px 10px',
                  borderRadius:
                    msg.role === 'user'
                      ? '10px 10px 2px 10px'
                      : '10px 10px 10px 2px',
                  background:
                    msg.role === 'user'
                      ? 'rgba(78, 121, 167, 0.12)'
                      : 'rgba(248, 250, 252, 0.9)',
                  border:
                    msg.role === 'user'
                      ? '1px solid rgba(78, 121, 167, 0.2)'
                      : '1px solid rgba(203, 213, 225, 0.4)',
                  fontSize: 13,
                  lineHeight: 1.45,
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {msg.role === 'assistant' && msg.content && entityMarkers && onHighlight ? (
                  <MarkedText
                    text={msg.content}
                    markers={entityMarkers}
                    onHighlight={onHighlight}
                  />
                ) : (
                  msg.content
                )}
                {msg.via && (
                  <span
                    title={msg.via === 'voice' ? 'Spoken' : 'Typed during call'}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      marginLeft: 4,
                      verticalAlign: 'middle',
                      opacity: 0.45,
                    }}
                  >
                    {msg.via === 'voice' ? (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="23" />
                        <line x1="8" y1="23" x2="16" y2="23" />
                      </svg>
                    ) : (
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" ry="2" />
                        <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10" />
                      </svg>
                    )}
                  </span>
                )}
              </div>
            </div>
            </React.Fragment>
          )
        })}
        {isStreaming &&
          messages.length > 0 &&
          !messages[messages.length - 1].content && (
            <div
              style={{
                fontSize: 11,
                color: '#94a3b8',
                fontStyle: 'italic',
                paddingLeft: 26,
              }}
            >
              {character.chat.streamingLabel}
            </div>
          )}
        <div ref={messagesEndRef} />

        {/* Ringing overlay — absolute over messages area */}
        {isRinging && (
          <div
            data-element="ringing-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255, 255, 255, 0.85)',
              zIndex: 3,
              gap: 8,
            }}
          >
            {/* Profile photo with pulsing rings */}
            <div style={{ position: 'relative', width: 72, height: 72 }}>
              {[0, 0.4, 0.8].map((delay, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    inset: -6,
                    borderRadius: '50%',
                    border: '2px solid rgba(109, 40, 217, 0.3)',
                    animation: `ringPulse 2s ease-out ${delay}s infinite`,
                  }}
                />
              ))}
              <img
                src={character.profileImage}
                alt={character.displayName}
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
            <div style={{ fontSize: 13, color: '#6b7280' }}>Calling...</div>
            <button
              data-action="cancel-ringing"
              onClick={callState!.onHangUp}
              style={{
                marginTop: 4,
                border: 'none',
                background: dangerColor,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                padding: '6px 20px',
                borderRadius: 14,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Input bar */}
      <div
        data-element="chat-input"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderTop: '1px solid rgba(203, 213, 225, 0.5)',
          background: 'rgba(248, 250, 252, 0.6)',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={character.chat.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
          style={{
            flex: 1,
            border: '1px solid rgba(203, 213, 225, 0.6)',
            borderRadius: 8,
            padding: '6px 10px',
            fontSize: 13,
            outline: 'none',
            background: 'white',
            color: '#1e293b',
            fontFamily: 'inherit',
          }}
        />
        <button
          data-action="send-chat"
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          title="Send"
          style={{
            border: 'none',
            background:
              input.trim() && !isStreaming ? '#4E79A7' : '#cbd5e1',
            color: 'white',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor:
              input.trim() && !isStreaming ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 0.15s ease',
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      {/* Keyframes for call animations — only injected when callState is present */}
      {callState && (
        <style>{`
          @keyframes ringPulse {
            0% { transform: scale(0.8); opacity: 1; }
            100% { transform: scale(1.4); opacity: 0; }
          }
          @keyframes waveBarMini {
            0% { height: 4px; }
            100% { height: 16px; }
          }
        `}</style>
      )}
    </div>
  )
}
