import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import type { ChatCallState, ChatMessage } from '@/lib/character/types'
import { EuclidChatPanel } from './chat/EuclidChatPanel'
import type { EuclidEntityRef } from './chat/parseGeometricEntities'
import type { UseEuclidChatReturn } from './chat/useEuclidChat'

type RenderEntityFn = (entity: EuclidEntityRef, displayText: string, index: number) => React.ReactNode

interface EuclidAssemblyQuadProps {
  quadOffset: { x: number; y: number }
  quadRef: React.Ref<HTMLDivElement>
  quadDragging: boolean
  handleQuadPointerDown: (e: React.PointerEvent) => void
  handleQuadPointerMove: (e: React.PointerEvent) => void
  handleQuadPointerUp: (e: React.PointerEvent) => void
  chatMounted: boolean
  chatExpanded: boolean
  chatMode: 'closed' | 'docked' | 'floating'
  setChatMode: Dispatch<SetStateAction<'closed' | 'docked' | 'floating'>>
  euclidChat: UseEuclidChatReturn
  handleChatSend: (text: string) => void
  handleChatHighlight: (entity: EuclidEntityRef | null) => void
  chatCallState: ChatCallState | undefined
  euclidVoice: { state: string; dial: () => void }
  audioEnabled: boolean
  toggleAudio: () => void
  smProfileImage: string
  renderEntity: RenderEntityFn
  isVisualDebugEnabled: boolean
  playgroundMode: boolean
  dockedInputRef: MutableRefObject<HTMLInputElement | null>
}

export function EuclidAssemblyQuad({
  quadOffset,
  quadRef,
  quadDragging,
  handleQuadPointerDown,
  handleQuadPointerMove,
  handleQuadPointerUp,
  chatMounted,
  chatExpanded,
  chatMode,
  setChatMode,
  euclidChat,
  handleChatSend,
  handleChatHighlight,
  chatCallState,
  euclidVoice,
  audioEnabled,
  toggleAudio,
  smProfileImage,
  renderEntity,
  isVisualDebugEnabled,
  playgroundMode,
  dockedInputRef,
}: EuclidAssemblyQuadProps) {
  return (
    <div
      ref={quadRef}
      data-component="euclid-assembly"
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        zIndex: 12,
        transform: `translate(${quadOffset.x}px, ${quadOffset.y}px)`,
      }}
    >
      {/* Floating chat panel — only when mode is 'floating' */}
      {chatMounted && (
        <div
          data-element="chat-anim-wrapper"
          style={{
            position: 'absolute',
            bottom: 38,
            right: 38,
            zIndex: 1,
            transformOrigin: '100% 100%',
            transform: chatExpanded ? 'scale(1)' : 'scale(0)',
            opacity: chatExpanded ? 1 : 0,
            transition: chatExpanded
              ? 'transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.2s ease'
              : 'transform 0.2s ease-in, opacity 0.15s ease-in',
            willChange: 'transform, opacity',
          }}
        >
          <EuclidChatPanel
            messages={euclidChat.messages}
            isStreaming={euclidVoice.state === 'active' ? false : euclidChat.isStreaming}
            onSend={handleChatSend}
            onClose={() => setChatMode('closed')}
            onHighlight={handleChatHighlight}
            renderEntity={renderEntity}
            onDragPointerDown={handleQuadPointerDown}
            onDragPointerMove={handleQuadPointerMove}
            onDragPointerUp={handleQuadPointerUp}
            isDragging={quadDragging}
            squareBottomRight
            debugCompaction={
              isVisualDebugEnabled
                ? {
                    coversUpTo: euclidChat.compaction.coversUpTo,
                    isSummarizing: !!euclidChat.compaction.isSummarizingRef.current,
                    onCompactUpTo: euclidChat.compaction.manualCompactUpTo,
                  }
                : undefined
            }
            callState={chatCallState}
          />
          {/* Dock button — pins chat into proof column (hidden in playground — no proof panel) */}
          {!playgroundMode && (
            <button
              data-action="dock-chat"
              onClick={() => setChatMode('docked')}
              title="Dock into proof panel"
              style={{
                position: 'absolute',
                top: 6,
                right: 32,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px 4px',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Pin/dock icon */}
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" rx="1" />
                <rect x="14" y="3" width="7" height="18" rx="1" />
                <rect x="3" y="14" width="7" height="7" rx="1" />
              </svg>
            </button>
          )}
        </div>
      )}
      {/* Quad: avatar (TL), mute (TR), call (BL), chat (BR) */}
      <div
        data-component="euclid-quad"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          width: 76,
          height: 76,
          borderRadius: 10,
          border: '1px solid rgba(203, 213, 225, 0.8)',
          background: 'rgba(255, 255, 255, 0.92)',
          backdropFilter: 'blur(8px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          position: 'relative',
        }}
      >
        {/* Cross dividers */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: 6,
            bottom: 6,
            width: 1,
            background: 'rgba(203, 213, 225, 0.5)',
            pointerEvents: 'none',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: 6,
            right: 6,
            height: 1,
            background: 'rgba(203, 213, 225, 0.5)',
            pointerEvents: 'none',
          }}
        />
        {/* TL: Euclid avatar — drag handle (disabled when floating chat is expanded) */}
        <div
          data-element="euclid-avatar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: !chatExpanded ? (quadDragging ? 'grabbing' : 'grab') : 'default',
            borderRadius: '9px 0 0 0',
            touchAction: 'none',
          }}
          onPointerDown={!chatExpanded ? handleQuadPointerDown : undefined}
          onPointerMove={!chatExpanded ? handleQuadPointerMove : undefined}
          onPointerUp={!chatExpanded ? handleQuadPointerUp : undefined}
          onPointerCancel={!chatExpanded ? handleQuadPointerUp : undefined}
          onMouseEnter={(e) => {
            if (chatMode === 'floating') return
            const popover = e.currentTarget.querySelector(
              '[data-element="euclid-popover"]'
            ) as HTMLElement
            if (popover) popover.style.opacity = '1'
          }}
          onMouseLeave={(e) => {
            const popover = e.currentTarget.querySelector(
              '[data-element="euclid-popover"]'
            ) as HTMLElement
            if (popover) popover.style.opacity = '0'
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={smProfileImage}
            alt="Εὐκλείδης"
            style={{
              width: 30,
              height: 30,
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
          {/* Popover — only when floating chat is not expanded */}
          {!chatExpanded && (
            <div
              data-element="euclid-popover"
              style={{
                position: 'absolute',
                bottom: '100%',
                right: -38,
                marginBottom: 8,
                width: 220,
                padding: '10px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.95)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(203, 213, 225, 0.8)',
                boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
                opacity: 0,
                transition: 'opacity 0.15s ease',
                pointerEvents: 'none',
                zIndex: 20,
                fontSize: 12,
                lineHeight: 1.45,
                color: '#374151',
                fontFamily: 'system-ui, sans-serif',
                fontStyle: 'italic',
              }}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontStyle: 'normal',
                  marginBottom: 4,
                  fontSize: 13,
                }}
              >
                Εὐκλείδης
              </div>
              <div style={{ marginBottom: 6 }}>
                &ldquo;I am here if you need guidance. You may call upon me by voice, or write
                to me if you prefer. I can also narrate your progress as you work.&rdquo;
              </div>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  fontStyle: 'normal',
                  fontSize: 11,
                  color: '#6b7280',
                }}
              >
                <span>
                  <strong style={{ color: '#4E79A7' }}>📞 Call</strong> — speak with me
                  directly
                </span>
                <span>
                  <strong style={{ color: '#4E79A7' }}>💬 Chat</strong> — write to me
                </span>
                <span>
                  <strong style={{ color: '#4E79A7' }}>🔊 Sound</strong> — toggle my narration
                </span>
              </div>
              {/* Arrow */}
              <div
                style={{
                  position: 'absolute',
                  bottom: -5,
                  left: 24,
                  width: 10,
                  height: 10,
                  background: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid rgba(203, 213, 225, 0.8)',
                  borderTop: 'none',
                  borderLeft: 'none',
                  transform: 'rotate(45deg)',
                }}
              />
            </div>
          )}
        </div>
        {/* TR: Mute/unmute */}
        <button
          data-action="toggle-audio"
          onClick={toggleAudio}
          title={audioEnabled ? 'Mute narration' : 'Enable narration'}
          style={{
            border: 'none',
            background: 'transparent',
            color: audioEnabled ? '#4E79A7' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: 0,
            transition: 'background 0.15s ease, color 0.15s ease',
            borderRadius: '0 9px 0 0',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(78, 121, 167, 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            {audioEnabled ? (
              <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            ) : (
              <line x1="23" y1="9" x2="17" y2="15" />
            )}
          </svg>
        </button>
        {/* BL: Call */}
        <button
          data-action="call-euclid"
          onClick={euclidVoice.state === 'idle' ? euclidVoice.dial : undefined}
          title="Call Εὐκλείδης"
          style={{
            border: 'none',
            background: 'transparent',
            color: euclidVoice.state === 'idle' ? '#4E79A7' : '#94a3b8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: euclidVoice.state === 'idle' ? 'pointer' : 'default',
            padding: 0,
            transition: 'background 0.15s ease, color 0.15s ease',
            borderRadius: '0 0 0 9px',
          }}
          onMouseEnter={(e) => {
            if (euclidVoice.state === 'idle')
              e.currentTarget.style.background = 'rgba(78, 121, 167, 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>
        {/* BR: Chat — toggles docked mode; disabled during active voice call */}
        <button
          data-action="chat-euclid"
          onClick={
            euclidVoice.state !== 'idle'
              ? undefined
              : () =>
                  setChatMode((m) => {
                    if (m === 'closed') {
                      requestAnimationFrame(() => dockedInputRef.current?.focus())
                      return 'docked'
                    }
                    return 'closed'
                  })
          }
          title={chatMode !== 'closed' ? 'Close chat' : 'Open chat'}
          style={{
            border: 'none',
            background: chatMode !== 'closed' ? 'rgba(78, 121, 167, 0.12)' : 'transparent',
            color: euclidVoice.state !== 'idle' ? '#94a3b8' : '#4E79A7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: euclidVoice.state !== 'idle' ? 'default' : 'pointer',
            padding: 0,
            transition: 'background 0.15s ease, color 0.15s ease',
            borderRadius: '0 0 9px 0',
          }}
          onMouseEnter={(e) => {
            if (euclidVoice.state === 'idle')
              e.currentTarget.style.background =
                chatMode !== 'closed'
                  ? 'rgba(78, 121, 167, 0.16)'
                  : 'rgba(78, 121, 167, 0.08)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              chatMode !== 'closed' ? 'rgba(78, 121, 167, 0.12)' : 'transparent'
          }}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </div>
    </div>
  )
}
