'use client'

/**
 * Docked Euclid chat — inline in the proof column (desktop) or a compact strip (mobile).
 *
 * Desktop: messages area + input, sits below proof steps in the right column.
 * Mobile: single-row strip showing last message preview + input field.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react'
import type { ChatMessage, ChatCallState } from '@/lib/character/types'
import type { DebugCompactionProps } from '@/lib/character/CharacterChatPanel'
import type { GeometricEntityRef } from './parseGeometricEntities'
import { MarkedText } from '@/lib/character/MarkedText'
import { stripEntityMarkers } from '@/lib/character/parseEntityMarkers'
import { EUCLID_CHARACTER_DEF } from '../euclidCharacterDef'
import { EUCLID_ENTITY_MARKERS } from '../euclidEntityMarkers'
import { CallStatusChip } from '@/lib/character/CallStatusChip'

export interface DockedEuclidChatProps {
  messages: ChatMessage[]
  isStreaming: boolean
  onSend: (text: string) => void
  onHighlight: (entity: GeometricEntityRef | null) => void
  callState?: ChatCallState
  isMobile: boolean
  /** When true, the chat panel is hidden (desktop) or collapsed to strip (mobile) */
  collapsed: boolean
  /** Pop the chat out to the floating quad panel */
  onUndock?: () => void
  debugCompaction?: DebugCompactionProps
  /** Ref to expose the input element for external focus (e.g. quad button) */
  inputRef?: React.RefObject<HTMLInputElement | null>
  /** Initiate a voice call (replaces quad BL on mobile) */
  onCall?: () => void
  /** Whether a call can be initiated */
  canCall?: boolean
  /** Toggle audio/narration (replaces quad TR on mobile) */
  onToggleAudio?: () => void
  /** Whether audio is currently enabled */
  audioEnabled?: boolean
  /** Notifies parent when mobile expanded state changes */
  onExpandedChange?: (expanded: boolean) => void
  /** Cold-start the conversation — Euclid speaks first */
  onColdStart?: () => void
}

const DESKTOP_HEIGHT = 200
const MOBILE_STRIP_HEIGHT = 56
const ACCENT = '#4E79A7'
const DANGER = '#ef4444'
const CALL_ACCENT = '#7c3aed'

export function DockedEuclidChat({
  messages,
  isStreaming,
  onSend,
  onHighlight,
  callState,
  isMobile,
  collapsed,
  onUndock,
  debugCompaction,
  inputRef: externalInputRef,
  onCall,
  canCall,
  onToggleAudio,
  audioEnabled,
  onExpandedChange,
  onColdStart,
}: DockedEuclidChatProps) {
  const [input, setInput] = useState('')
  const [mobileExpanded, setMobileExpanded] = useState(false)
  const internalInputRef = useRef<HTMLInputElement>(null)
  // Bridge external ref: callback ref writes to whichever ref object is active
  const setInputRef = useCallback((el: HTMLInputElement | null) => {
    (internalInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
    if (externalInputRef) {
      (externalInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el
    }
  }, [externalInputRef])
  const inputRef = internalInputRef
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const userScrolledAwayRef = useRef(false)
  const programmaticScrollRef = useRef(false)

  // Collapse mobile expanded view when the panel is collapsed externally
  useEffect(() => {
    if (collapsed) {
      setMobileExpanded(false)
      onExpandedChange?.(false)
    }
  }, [collapsed, onExpandedChange])

  // Notify parent when expanded state changes
  const setMobileExpandedAndNotify = useCallback((expanded: boolean) => {
    setMobileExpanded(expanded)
    onExpandedChange?.(expanded)
  }, [onExpandedChange])

  const isCallActive = callState?.state === 'ringing' || callState?.state === 'active'
  const isRinging = callState?.state === 'ringing'
  const isActive = callState?.state === 'active'
  const isCallError = callState?.state === 'error'

  const handleMessagesScroll = useCallback(() => {
    if (programmaticScrollRef.current) return
    const el = messagesContainerRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40
    userScrolledAwayRef.current = !nearBottom
  }, [])

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

  // Last assistant message for mobile preview
  const lastAssistantMsg = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      if (m.role === 'assistant' && !m.isEvent && !m.isError && m.content) return m
    }
    return null
  }, [messages])

  // Whether a real conversation has started (not just construction events)
  const hasConversation = useMemo(
    () => messages.some(m => !m.isEvent),
    [messages],
  )

  // Desktop collapsed or mobile collapsed: render nothing (give space back)
  if (collapsed) return null

  if (isMobile) {
    if (mobileExpanded) {
      // Full messages view on mobile — same as desktop but adapted
      return (
        <DesktopDockedChat
          messages={messages}
          isStreaming={isStreaming}
          input={input}
          setInput={setInput}
          inputRef={setInputRef}
          onSend={handleSend}
          onKeyDown={handleKeyDown}
          onHighlight={onHighlight}
          messagesContainerRef={messagesContainerRef}
          handleMessagesScroll={handleMessagesScroll}
          callState={callState}
          isCallActive={isCallActive}
          isRinging={isRinging}
          isActive={isActive}
          isCallError={isCallError}
          debugCompaction={debugCompaction}
          onCollapse={() => setMobileExpandedAndNotify(false)}
          onCall={onCall}
          canCall={canCall}
          onToggleAudio={onToggleAudio}
          audioEnabled={audioEnabled}
        />
      )
    }
    return (
      <MobileChatStrip
        input={input}
        setInput={setInput}
        inputRef={setInputRef}
        onSend={handleSend}
        onKeyDown={handleKeyDown}
        isStreaming={isStreaming}
        lastAssistantMsg={lastAssistantMsg}
        callState={callState}
        isRinging={isRinging}
        isActive={isActive}
        onExpand={() => setMobileExpandedAndNotify(true)}
        hasMessages={hasConversation}
        onCall={onCall}
        canCall={canCall}
        onToggleAudio={onToggleAudio}
        audioEnabled={audioEnabled}
        onColdStart={onColdStart}
      />
    )
  }

  return (
    <DesktopDockedChat
      messages={messages}
      isStreaming={isStreaming}
      input={input}
      setInput={setInput}
      inputRef={setInputRef}
      onSend={handleSend}
      onKeyDown={handleKeyDown}
      onHighlight={onHighlight}
      messagesContainerRef={messagesContainerRef}
      handleMessagesScroll={handleMessagesScroll}
      callState={callState}
      isCallActive={isCallActive}
      isRinging={isRinging}
      isActive={isActive}
      isCallError={isCallError}
      debugCompaction={debugCompaction}
      height={DESKTOP_HEIGHT}
      onUndock={onUndock}
    />
  )
}

// ── Desktop: full messages + input ──

interface DesktopDockedChatProps {
  messages: ChatMessage[]
  isStreaming: boolean
  input: string
  setInput: (v: string) => void
  inputRef: React.RefCallback<HTMLInputElement>
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  onHighlight: (entity: GeometricEntityRef | null) => void
  messagesContainerRef: React.MutableRefObject<HTMLDivElement | null>
  handleMessagesScroll: () => void
  callState?: ChatCallState
  isCallActive: boolean
  isRinging: boolean | undefined
  isActive: boolean | undefined
  isCallError: boolean | undefined
  debugCompaction?: DebugCompactionProps
  height?: number
  /** When provided, shows a collapse chevron in the header (used in mobile expanded mode) */
  onCollapse?: () => void
  /** Pop the chat out to the floating quad panel */
  onUndock?: () => void
  /** Initiate a voice call (mobile expanded mode) */
  onCall?: () => void
  /** Whether the call button should be shown */
  canCall?: boolean
  /** Toggle narration audio (mobile expanded mode) */
  onToggleAudio?: () => void
  /** Whether narration audio is enabled */
  audioEnabled?: boolean
}

function DesktopDockedChat({
  messages,
  isStreaming,
  input,
  setInput,
  inputRef,
  onSend,
  onKeyDown,
  onHighlight,
  messagesContainerRef,
  handleMessagesScroll,
  callState,
  isCallActive,
  isRinging,
  isActive,
  isCallError,
  debugCompaction,
  height,
  onCollapse,
  onUndock,
  onCall,
  canCall,
  onToggleAudio,
  audioEnabled,
}: DesktopDockedChatProps) {
  return (
    <div
      data-component="docked-euclid-chat"
      data-variant={onCollapse ? 'mobile-expanded' : 'desktop'}
      style={{
        ...(height != null ? { height, flexShrink: 0 } : { height: 'calc(100dvh / 3)', flexShrink: 0 }),
        display: 'flex',
        flexDirection: 'column',
        borderTop: '1px solid rgba(203, 213, 225, 0.6)',
        background: '#FAFAF0',
        fontFamily: 'system-ui, sans-serif',
        overflow: 'hidden',
      }}
    >
      {/* Thin header: avatar + name + call state */}
      <div
        data-element="docked-chat-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 12px',
          borderBottom: '1px solid rgba(203, 213, 225, 0.3)',
          flexShrink: 0,
        }}
      >
        {/* Left: cross-fade between idle avatar+name and call status chip */}
        <div style={{ display: 'grid', alignItems: 'center', minWidth: 0 }}>
          {callState && (
            <div style={{ gridRow: 1, gridColumn: 1 }}>
              <CallStatusChip character={EUCLID_CHARACTER_DEF} callState={callState} size="compact" />
            </div>
          )}
          <div style={{
            gridRow: 1, gridColumn: 1,
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: isCallActive ? 0 : 1,
            transition: 'opacity 0.25s ease',
            pointerEvents: isCallActive ? 'none' : 'auto',
          }}>
            <img
              src={EUCLID_CHARACTER_DEF.profileImage}
              alt={EUCLID_CHARACTER_DEF.displayName}
              style={{
                width: 16,
                height: 16,
                borderRadius: '50%',
                objectFit: 'cover',
                flexShrink: 0,
              }}
            />
            <span style={{ fontWeight: 600, fontSize: 11, color: '#1e293b' }}>
              {EUCLID_CHARACTER_DEF.nativeDisplayName}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {onUndock && !onCollapse && (
            <button
              data-action="undock-chat"
              onClick={onUndock}
              title="Pop out to floating panel"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: 14,
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* External link / pop-out icon */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </button>
          )}
          {onCollapse && onToggleAudio && (
            <button
              data-action="toggle-audio-expanded"
              onClick={onToggleAudio}
              title={audioEnabled ? 'Mute narration' : 'Enable narration'}
              style={{
                border: 'none',
                background: 'transparent',
                color: audioEnabled ? '#4E79A7' : '#94a3b8',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                {audioEnabled ? (
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                ) : (
                  <line x1="23" y1="9" x2="17" y2="15" />
                )}
              </svg>
            </button>
          )}
          {onCollapse && canCall && onCall && !isCallActive && (
            <button
              data-action="call-euclid-expanded"
              onClick={onCall}
              title="Call Εὐκλείδης"
              style={{
                border: 'none',
                background: 'transparent',
                color: '#4E79A7',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
            </button>
          )}
          {onCollapse && (
            <button
              data-action="collapse-chat"
              onClick={onCollapse}
              title="Collapse"
              style={{
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                fontSize: 14,
                lineHeight: 1,
                padding: '2px 4px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        data-element="docked-chat-messages"
        onScroll={handleMessagesScroll}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          minHeight: 0,
          userSelect: 'text',
          WebkitUserSelect: 'text',
          position: 'relative',
        }}
      >
        {/* Error banner */}
        {isCallError && callState && (
          <div
            data-element="call-error-banner"
            style={{
              position: 'sticky',
              top: 0,
              zIndex: 2,
              background: 'rgba(254, 242, 242, 0.95)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 6,
              padding: '6px 10px',
              fontSize: 11,
              textAlign: 'center',
            }}
          >
            <div style={{ fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>
              Couldn&apos;t connect
            </div>
            <div style={{ color: '#6b7280', marginBottom: 6, lineHeight: 1.3 }}>
              {callState.error || 'Something went wrong'}
            </div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
              {callState.errorCode !== 'quota_exceeded' && (
                <button
                  data-action="retry-call"
                  onClick={callState.onRetry}
                  style={{
                    border: 'none',
                    background: CALL_ACCENT,
                    color: '#fff',
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 8,
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
                  fontSize: 11,
                  fontWeight: 600,
                  padding: '3px 10px',
                  borderRadius: 8,
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
              fontSize: 11,
              textAlign: 'center',
              padding: '12px 8px',
              fontStyle: 'italic',
            }}
          >
            {EUCLID_CHARACTER_DEF.chat.emptyPrompt}
          </div>
        )}
        {messages.map((msg, msgIndex) => {
          // Debug compaction divider
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
                      fontSize: 8,
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

          if (msg.isEvent) {
            return (
              <React.Fragment key={msg.id}>
                {compactionDivider}
                <div
                  data-element="chat-message-event"
                  style={{
                    textAlign: 'center',
                    padding: '2px 8px',
                    fontSize: 10,
                    color: '#94a3b8',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span style={{ width: 3, height: 3, borderRadius: '50%', background: '#cbd5e1', flexShrink: 0 }} />
                    {msg.content}
                  </div>
                </div>
              </React.Fragment>
            )
          }
          if (msg.isError) {
            return (
              <React.Fragment key={msg.id}>
                {compactionDivider}
                <div
                  data-element="chat-message-error"
                  style={{
                    textAlign: 'center',
                    padding: '4px 8px',
                    fontSize: 11,
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
                  gap: 4,
                }}
              >
                {msg.role === 'assistant' && (
                  <img
                    src={EUCLID_CHARACTER_DEF.profileImage}
                    alt=""
                    style={{
                      width: 14,
                      height: 14,
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
                    padding: '4px 8px',
                    borderRadius:
                      msg.role === 'user'
                        ? '8px 8px 2px 8px'
                        : '8px 8px 8px 2px',
                    background:
                      msg.role === 'user'
                        ? 'rgba(78, 121, 167, 0.12)'
                        : 'rgba(248, 250, 252, 0.9)',
                    border:
                      msg.role === 'user'
                        ? '1px solid rgba(78, 121, 167, 0.2)'
                        : '1px solid rgba(203, 213, 225, 0.4)',
                    fontSize: 12,
                    lineHeight: 1.4,
                    color: '#1e293b',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {msg.role === 'assistant' && msg.content ? (
                    <MarkedText
                      text={msg.content}
                      markers={EUCLID_ENTITY_MARKERS}
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
                        marginLeft: 3,
                        verticalAlign: 'middle',
                        opacity: 0.45,
                      }}
                    >
                      {msg.via === 'voice' ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                          <line x1="12" y1="19" x2="12" y2="23" />
                          <line x1="8" y1="23" x2="16" y2="23" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
                fontSize: 10,
                color: '#94a3b8',
                fontStyle: 'italic',
                paddingLeft: 20,
              }}
            >
              {EUCLID_CHARACTER_DEF.chat.streamingLabel}
            </div>
          )}
        {/* Ringing overlay */}
        {isRinging && callState && (
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
              gap: 6,
            }}
          >
            <div style={{ position: 'relative', width: 48, height: 48 }}>
              {[0, 0.4, 0.8].map((delay, i) => (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    inset: -4,
                    borderRadius: '50%',
                    border: '2px solid rgba(109, 40, 217, 0.3)',
                    animation: `ringPulse 2s ease-out ${delay}s infinite`,
                  }}
                />
              ))}
              <img
                src={EUCLID_CHARACTER_DEF.profileImage}
                alt={EUCLID_CHARACTER_DEF.displayName}
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: '#6b7280' }}>Calling...</div>
            <button
              data-action="cancel-ringing"
              onClick={callState.onHangUp}
              style={{
                border: 'none',
                background: DANGER,
                color: '#fff',
                fontSize: 11,
                fontWeight: 600,
                padding: '4px 14px',
                borderRadius: 10,
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
        data-element="docked-chat-input"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '4px 8px',
          borderTop: '1px solid rgba(203, 213, 225, 0.3)',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder={EUCLID_CHARACTER_DEF.chat.placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={isStreaming}
          style={{
            flex: 1,
            border: '1px solid rgba(203, 213, 225, 0.6)',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 12,
            outline: 'none',
            background: 'white',
            color: '#1e293b',
            fontFamily: 'inherit',
          }}
        />
        <button
          data-action="send-docked-chat"
          onClick={onSend}
          disabled={!input.trim() || isStreaming}
          title="Send"
          style={{
            border: 'none',
            background: input.trim() && !isStreaming ? ACCENT : '#cbd5e1',
            color: 'white',
            borderRadius: 6,
            width: 28,
            height: 28,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
            flexShrink: 0,
            transition: 'background 0.15s ease',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ── Mobile: compact strip ──

interface MobileChatStripProps {
  input: string
  setInput: (v: string) => void
  inputRef: React.RefCallback<HTMLInputElement>
  onSend: () => void
  onKeyDown: (e: React.KeyboardEvent) => void
  isStreaming: boolean
  lastAssistantMsg: ChatMessage | null
  callState?: ChatCallState
  isRinging: boolean | undefined
  isActive: boolean | undefined
  onExpand: () => void
  hasMessages: boolean
  onCall?: () => void
  canCall?: boolean
  onToggleAudio?: () => void
  audioEnabled?: boolean
  onColdStart?: () => void
}

function MobileChatStrip({
  input,
  setInput,
  inputRef,
  onSend,
  onKeyDown,
  isStreaming,
  lastAssistantMsg,
  callState,
  isRinging,
  isActive,
  onExpand,
  hasMessages,
  onCall,
  canCall,
  onToggleAudio,
  audioEnabled,
  onColdStart,
}: MobileChatStripProps) {
  const isCallActive = callState?.state === 'ringing' || callState?.state === 'active'
  const [inputFocused, setInputFocused] = useState(false)

  const handleMobileSend = useCallback(() => {
    if (!input.trim()) return
    setInputFocused(false)
    onSend()
  }, [input, onSend])

  const handleMobileKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleMobileSend()
    } else {
      onKeyDown(e)
    }
  }, [handleMobileSend, onKeyDown])

  return (
    <div
      data-component="docked-euclid-chat"
      data-variant="mobile"
      style={{
        height: MOBILE_STRIP_HEIGHT,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 8px',
        borderTop: '1px solid rgba(203, 213, 225, 0.6)',
        background: '#FAFAF0',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* Grid overlay: call layout and idle layout cross-fade */}
      <div style={{ display: 'grid', alignItems: 'center', flex: 1, minWidth: 0 }}>
        {/* Call layout — chip + audio toggle */}
        {callState && (
          <div style={{
            gridRow: 1, gridColumn: 1,
            display: 'flex', alignItems: 'center', gap: 6,
            opacity: isCallActive ? 1 : 0,
            transition: 'opacity 0.25s ease',
            pointerEvents: isCallActive ? 'auto' : 'none',
          }}>
            <CallStatusChip character={EUCLID_CHARACTER_DEF} callState={callState} size="medium" showName={false} />
            {onToggleAudio && (
              <button
                data-action="toggle-audio-mobile"
                onClick={onToggleAudio}
                title={audioEnabled ? 'Mute narration' : 'Enable narration'}
                tabIndex={isCallActive ? 0 : -1}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: audioEnabled ? '#4E79A7' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 2,
                  flexShrink: 0,
                  borderRadius: 4,
                  width: 24,
                  height: 24,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {audioEnabled ? (
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  ) : (
                    <line x1="23" y1="9" x2="17" y2="15" />
                  )}
                </svg>
              </button>
            )}
          </div>
        )}
        {/* Idle layout — avatar + preview + action buttons + input + send */}
        <div style={{
          gridRow: 1, gridColumn: 1,
          display: 'flex', alignItems: 'center', gap: 6,
          opacity: isCallActive ? 0 : 1,
          transition: 'opacity 0.25s ease',
          pointerEvents: isCallActive ? 'none' : 'auto',
        }}>
          {/* Avatar */}
          <img
            src={EUCLID_CHARACTER_DEF.profileImage}
            alt={EUCLID_CHARACTER_DEF.displayName}
            style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              objectFit: 'cover',
              flexShrink: 0,
            }}
          />

          {/* Middle: last message preview — tap to expand / cold-start */}
          <div
            onClick={hasMessages ? onExpand : (onColdStart && !isStreaming ? onColdStart : undefined)}
            style={{
              flex: 1,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              cursor: hasMessages ? 'pointer' : (onColdStart && !isStreaming ? 'pointer' : undefined),
            }}
          >
            {isStreaming ? (
              <span style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>
                {EUCLID_CHARACTER_DEF.chat.streamingLabel}
              </span>
            ) : lastAssistantMsg ? (
              <span
                style={{
                  fontSize: 11,
                  color: '#64748b',
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical' as const,
                  lineHeight: 1.3,
                }}
              >
                {stripEntityMarkers(lastAssistantMsg.content, EUCLID_ENTITY_MARKERS)}
                {hasMessages && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4, verticalAlign: 'middle', flexShrink: 0 }}>
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                )}
              </span>
            ) : (
              <span style={{
                fontSize: 11,
                color: onColdStart ? ACCENT : '#94a3b8',
                fontStyle: 'italic',
              }}>
                {onColdStart ? 'Tap to ask Euclid for help' : EUCLID_CHARACTER_DEF.chat.emptyPrompt}
              </span>
            )}
          </div>

          {/* Action buttons — collapse when input is focused */}
          <div
            data-element="mobile-action-buttons"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              flexShrink: 0,
              overflow: 'hidden',
              width: inputFocused ? 0 : ((onToggleAudio ? 24 : 0) + (canCall && onCall ? 24 + 2 : 0)),
              opacity: inputFocused ? 0 : 1,
              transition: 'width 0.2s ease, opacity 0.15s ease',
            }}
          >
            {onToggleAudio && (
              <button
                data-action="toggle-audio-mobile"
                onClick={onToggleAudio}
                title={audioEnabled ? 'Mute narration' : 'Enable narration'}
                tabIndex={inputFocused ? -1 : 0}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: audioEnabled ? '#4E79A7' : '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 2,
                  flexShrink: 0,
                  borderRadius: 4,
                  width: 24,
                  height: 24,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  {audioEnabled ? (
                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                  ) : (
                    <line x1="23" y1="9" x2="17" y2="15" />
                  )}
                </svg>
              </button>
            )}
            {canCall && onCall && (
              <button
                data-action="call-euclid-mobile"
                onClick={onCall}
                title="Call Εὐκλείδης"
                tabIndex={inputFocused ? -1 : 0}
                style={{
                  border: 'none',
                  background: 'transparent',
                  color: '#4E79A7',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  padding: 2,
                  flexShrink: 0,
                  borderRadius: 4,
                  width: 24,
                  height: 24,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </button>
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Ask..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleMobileKeyDown}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            disabled={isStreaming}
            style={{
              flex: inputFocused ? 1 : undefined,
              width: inputFocused ? undefined : 90,
              flexShrink: 1,
              minWidth: 60,
              border: '1px solid rgba(203, 213, 225, 0.6)',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 12,
              outline: 'none',
              background: 'white',
              color: '#1e293b',
              fontFamily: 'inherit',
            }}
          />
          <button
            data-action="send-docked-chat"
            onClick={handleMobileSend}
            disabled={!input.trim() || isStreaming}
            title="Send"
            style={{
              border: 'none',
              background: input.trim() && !isStreaming ? ACCENT : '#cbd5e1',
              color: 'white',
              borderRadius: 6,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !isStreaming ? 'pointer' : 'default',
              flexShrink: 0,
              transition: 'background 0.15s ease',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22 2 15 22 11 13 2 9 22 2" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

