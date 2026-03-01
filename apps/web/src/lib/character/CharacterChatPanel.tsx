'use client'

/**
 * Generic floating glassmorphism chat panel for character conversations.
 *
 * Parameterized on character identity (name, image, strings) and an optional
 * entity marker system for domain-specific inline highlights.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { CharacterDefinition, ChatMessage, EntityMarkerConfig } from './types'
import { MarkedText } from './MarkedText'

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

  return (
    <div
      data-component="character-chat-panel"
      style={{
        width: 300,
        maxHeight: 420,
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
      {/* Header — drag handle when drag props provided */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src={character.profileImage}
            alt={character.displayName}
            style={{
              width: 24,
              height: 24,
              borderRadius: '50%',
              objectFit: 'cover',
            }}
          />
          <span
            style={{
              fontWeight: 600,
              fontSize: 13,
              color: '#1e293b',
            }}
          >
            {headerName}
          </span>
        </div>
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
          minHeight: 200,
          maxHeight: 310,
          userSelect: 'text',
          WebkitUserSelect: 'text',
        }}
      >
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
        {messages.map((msg) => {
          // Error messages render as centered system notices, not character speech
          if (msg.isError) {
            return (
              <div
                key={msg.id}
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
            )
          }
          return (
            <div
              key={msg.id}
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
    </div>
  )
}
