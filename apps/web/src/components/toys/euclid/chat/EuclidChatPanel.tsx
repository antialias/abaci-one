'use client'

/**
 * Floating glassmorphism chat panel for text conversation with Euclid.
 */

import { useState, useRef, useEffect, useCallback } from 'react'
import type { ChatMessage } from './useEuclidChat'
import type { GeometricEntityRef } from './parseGeometricEntities'
import { GeometricText } from './GeometricText'

interface EuclidChatPanelProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (text: string) => void
  onClose: () => void
  knownLabels: Set<string>
  onHighlight: (entity: GeometricEntityRef | null) => void
}

export function EuclidChatPanel({ messages, isStreaming, onSend, onClose, knownLabels, onHighlight }: EuclidChatPanelProps) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
    [handleSend]
  )

  return (
    <div
      data-component="euclid-chat-panel"
      style={{
        position: 'absolute',
        top: 52,
        right: 12,
        width: 300,
        maxHeight: 420,
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 12,
        border: '1px solid rgba(203, 213, 225, 0.8)',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.12)',
        zIndex: 16,
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
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
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/euclid-profile.png"
            alt="Euclid"
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
            {'\u0395\u1F50\u03BA\u03BB\u03B5\u03AF\u03B4\u03B7\u03C2'}
          </span>
        </div>
        <button
          data-action="close-chat"
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
        data-element="chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          minHeight: 200,
          maxHeight: 310,
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
            Ask Euclid about the construction, proof, or what to do next.
          </div>
        )}
        {messages.map((msg) => (
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
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/images/euclid-profile.png"
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
                borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
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
              {msg.role === 'assistant' && msg.content ? (
                <GeometricText
                  text={msg.content}
                  knownLabels={knownLabels}
                  onHighlight={onHighlight}
                />
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isStreaming && messages.length > 0 && !messages[messages.length - 1].content && (
          <div
            style={{
              fontSize: 11,
              color: '#94a3b8',
              fontStyle: 'italic',
              paddingLeft: 26,
            }}
          >
            Euclid is writing...
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
          placeholder="Ask Euclid..."
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
            background: input.trim() && !isStreaming ? '#4E79A7' : '#cbd5e1',
            color: 'white',
            borderRadius: 8,
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
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
