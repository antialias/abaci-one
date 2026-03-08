import type { CallState } from './talkToNumber/useRealtimeVoice'

interface ModeDebug {
  current: string
  previous: string | null
  transitions: Array<{
    from: string
    to: string
    action: string
    timestamp: number
    tools: string[]
  }>
}

interface VoiceDebugPanelsProps {
  voiceState: CallState
  modeDebug: ModeDebug | null
  activeGameId: string | null
  currentInstructions: string | null
  isDark: boolean
}

export function VoiceDebugPanels({
  voiceState,
  modeDebug,
  activeGameId,
  currentInstructions,
}: VoiceDebugPanelsProps) {
  return (
    <>
      {voiceState !== 'idle' && modeDebug && (
        <div
          data-component="voice-mode-debug"
          style={{
            position: 'fixed',
            top: 'calc(var(--app-nav-height, 56px) + 16px)',
            left: 16,
            zIndex: 9999,
            background: 'rgba(17,24,39,0.93)',
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            padding: '12px 16px',
            color: 'rgba(243,244,246,1)',
            fontSize: 12,
            width: 280,
            maxHeight: 'calc(100dvh - var(--app-nav-height, 56px) - 48px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: 0.6,
              marginBottom: 8,
              flexShrink: 0,
            }}
          >
            Voice State Machine
          </div>

          {/* Current state — prominent pill */}
          <div
            data-element="current-mode"
            style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}
          >
            <span
              style={{
                display: 'inline-block',
                padding: '2px 10px',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 13,
                color: '#fff',
                background:
                  (
                    {
                      answering: '#3b82f6',
                      familiarizing: '#8b5cf6',
                      default: '#22c55e',
                      conference: '#06b6d4',
                      exploration: '#f59e0b',
                      game: '#ef4444',
                      winding_down: '#f97316',
                      hanging_up: '#6b7280',
                    } as Record<string, string>
                  )[modeDebug.current] ?? '#6b7280',
              }}
            >
              {modeDebug.current}
            </span>
            {modeDebug.previous && (
              <span style={{ opacity: 0.5, fontSize: 11 }}>
                {'<-'} {modeDebug.previous}
              </span>
            )}
          </div>

          {/* Active game ID */}
          {activeGameId && (
            <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Game: {activeGameId}</div>
          )}

          {/* Transition log — scrollable, newest on top */}
          <div
            data-element="transition-log"
            style={{
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
              maxHeight: 200,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              paddingTop: 6,
              marginTop: 2,
            }}
          >
            {[...modeDebug.transitions].reverse().map((t, i) => {
              const age = Date.now() - t.timestamp
              const ageStr =
                age < 60_000 ? `${Math.round(age / 1000)}s` : `${Math.round(age / 60_000)}m`
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    gap: 6,
                    fontSize: 10,
                    lineHeight: '18px',
                    opacity: i === 0 ? 1 : 0.6,
                  }}
                >
                  <span
                    style={{ color: '#9ca3af', minWidth: 24, textAlign: 'right', flexShrink: 0 }}
                  >
                    {ageStr}
                  </span>
                  <span style={{ flexShrink: 0 }}>
                    {t.from} {'>'} {t.to}
                  </span>
                  <span
                    style={{
                      color: '#6b7280',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.action}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Active tools list */}
          {modeDebug.transitions.length > 0 && (
            <div
              data-element="active-tools"
              style={{
                fontSize: 10,
                color: '#6b7280',
                marginTop: 6,
                borderTop: '1px solid rgba(255,255,255,0.1)',
                paddingTop: 6,
                wordBreak: 'break-word',
              }}
            >
              Tools: {modeDebug.transitions[modeDebug.transitions.length - 1].tools.join(', ')}
            </div>
          )}
        </div>
      )}
      {currentInstructions && (
        <div
          data-component="voice-context-debug"
          style={{
            position: 'fixed',
            bottom: 16,
            right: 16,
            zIndex: 9999,
            background: 'rgba(17,24,39,0.93)',
            backdropFilter: 'blur(8px)',
            borderRadius: 8,
            padding: '12px 16px',
            color: 'rgba(243,244,246,1)',
            fontSize: 12,
            width: 'min(520px, calc(100vw - 320px))',
            maxHeight: 'calc(100dvh - var(--app-nav-height, 56px) - 48px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            pointerEvents: 'auto',
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: 11,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              opacity: 0.6,
              marginBottom: 8,
              flexShrink: 0,
            }}
          >
            Voice Agent Context ({Math.round(currentInstructions.length / 1000)}k chars)
          </div>
          <pre
            data-element="voice-context-text"
            style={{
              margin: 0,
              padding: 8,
              background: 'rgba(0,0,0,0.3)',
              borderRadius: 6,
              fontSize: 10,
              lineHeight: 1.4,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowY: 'auto',
              flex: 1,
              minHeight: 0,
              color: 'rgba(209, 213, 219, 0.9)',
              fontFamily: 'ui-monospace, "SF Mono", Menlo, monospace',
            }}
          >
            {currentInstructions}
          </pre>
        </div>
      )}
    </>
  )
}
