import { MiniWaveform, AnimatedDots, formatTime } from '@/lib/voice/PhoneCallOverlay'

export type HecklerPhase = 'watching' | 'ringing' | 'connecting' | 'active'

export function HecklerCallOverlay({
  phase,
  profileImage,
  lgProfileImage,
  characterName,
  isSpeaking,
  isThinking,
  timeRemaining,
  onAnswer,
  onDismiss,
  onHangUp,
}: {
  phase: HecklerPhase
  profileImage: string
  lgProfileImage: string
  characterName: string
  isSpeaking: boolean
  isThinking: boolean
  timeRemaining: number | null
  onAnswer: () => void
  onDismiss: () => void
  onHangUp: () => void
}) {
  const inCall = phase === 'connecting' || phase === 'active'

  // ── Position: bottom-center for watching/ringing, bottom-left for in-call ──
  const positionStyle: React.CSSProperties = inCall
    ? { bottom: 24, left: 24, transform: 'none' }
    : { bottom: 80, left: '50%', transform: 'translateX(-50%)' }

  // ── Layout: horizontal bar for watching/ringing, vertical card for in-call ──
  const layoutStyle: React.CSSProperties = inCall
    ? {
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        padding: '16px 20px',
        minWidth: 140,
        backdropFilter: 'blur(12px)',
      }
    : {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: phase === 'ringing' ? '12px 20px' : '8px 16px',
        minWidth: undefined,
        backdropFilter: undefined,
      }

  const glowColor = isSpeaking
    ? 'rgba(168, 85, 247, 0.7)'
    : isThinking
      ? 'rgba(168, 85, 247, 0.35)'
      : 'transparent'
  const glowShadow = isSpeaking
    ? `0 0 0 3px ${glowColor}, 0 0 20px ${glowColor}`
    : isThinking
      ? `0 0 0 2px ${glowColor}, 0 0 12px ${glowColor}`
      : '0 4px 16px rgba(0,0,0,0.3)'

  // Avatar size: 72px in-call, 40px ringing, 32px watching
  const avatarSize = inCall ? 72 : phase === 'ringing' ? 40 : 32

  return (
    <div
      data-element="heckler-call-overlay"
      data-phase={phase}
      style={{
        position: 'absolute',
        ...positionStyle,
        display: 'flex',
        ...layoutStyle,
        borderRadius: 16,
        background: phase === 'watching' ? 'rgba(15, 23, 42, 0.6)' : 'rgba(15, 23, 42, 0.92)',
        color: '#f8fafc',
        fontSize: 13,
        fontFamily: 'system-ui, sans-serif',
        boxShadow:
          phase === 'ringing'
            ? '0 8px 32px rgba(0,0,0,0.4), 0 0 0 2px rgba(78, 121, 167, 0.4)'
            : '0 8px 32px rgba(0,0,0,0.35)',
        zIndex: 20,
        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: phase === 'watching' ? 0.7 : 1,
        animation: phase === 'ringing' ? 'heckler-ring 1s ease-in-out infinite' : undefined,
        pointerEvents: phase === 'watching' ? 'none' : 'auto',
      }}
      onPointerDown={inCall ? (e) => e.stopPropagation() : undefined}
    >
      {/* Avatar */}
      <div
        style={{
          width: avatarSize,
          height: avatarSize,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          boxShadow: inCall ? glowShadow : undefined,
          transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
          animation:
            inCall && isSpeaking
              ? 'hecklerSpeakingPulse 1.5s ease-in-out infinite'
              : inCall && isThinking
                ? 'hecklerSpeakingPulse 2.5s ease-in-out infinite'
                : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={inCall ? lgProfileImage : profileImage}
          alt={characterName}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* ── Watching phase ── */}
      {phase === 'watching' && (
        <span style={{ fontSize: 12, opacity: 0.8 }}>{characterName} is watching...</span>
      )}

      {/* ── Ringing phase ── */}
      {phase === 'ringing' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>{characterName} is calling...</span>
            <span style={{ fontSize: 11, opacity: 0.7 }}>Incoming observation</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
            <button
              data-action="answer-heckler"
              onClick={onAnswer}
              style={{
                border: 'none',
                borderRadius: 20,
                padding: '6px 16px',
                background: '#22c55e',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Answer
            </button>
            <button
              data-action="dismiss-heckler"
              onClick={onDismiss}
              style={{
                border: 'none',
                borderRadius: 20,
                padding: '6px 16px',
                background: '#ef4444',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Dismiss
            </button>
          </div>
        </>
      )}

      {/* ── Connecting phase (stalling TTS) ── */}
      {phase === 'connecting' && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            <span>{characterName}</span>
            <MiniWaveform isDark active={isSpeaking} />
          </div>
          <span style={{ opacity: 0.6, fontSize: 12 }}>
            Connecting
            <AnimatedDots />
          </span>
          <button
            data-action="end-heckler-call"
            onClick={onHangUp}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 20,
              padding: '8px 0',
              background: 'rgba(239, 68, 68, 0.85)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 1)'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.85)'
            }}
          >
            End Call
          </button>
        </>
      )}

      {/* ── Active phase ── */}
      {phase === 'active' && (
        <>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {isThinking ? (
              <span style={{ opacity: 0.7, fontSize: 12 }}>
                Consulting scrolls
                <AnimatedDots />
              </span>
            ) : (
              <>
                <span>{characterName}</span>
                <MiniWaveform isDark active={isSpeaking} />
                {timeRemaining != null && (
                  <span style={{ opacity: 0.6, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>
                    {formatTime(timeRemaining)}
                  </span>
                )}
              </>
            )}
          </div>
          <button
            data-action="end-heckler-call"
            onClick={onHangUp}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              border: 'none',
              borderRadius: 20,
              padding: '8px 0',
              background: 'rgba(239, 68, 68, 0.85)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => {
              ;(e.target as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 1)'
            }}
            onMouseLeave={(e) => {
              ;(e.target as HTMLButtonElement).style.background = 'rgba(239, 68, 68, 0.85)'
            }}
          >
            End Call
          </button>
        </>
      )}

      <style>{`
        @keyframes heckler-ring {
          0%, 100% { transform: translateX(-50%) scale(1); }
          10% { transform: translateX(-50%) scale(1.02) rotate(-1deg); }
          20% { transform: translateX(-50%) scale(1.02) rotate(1deg); }
          30% { transform: translateX(-50%) scale(1.02) rotate(-1deg); }
          40% { transform: translateX(-50%) scale(1); }
        }
        @keyframes hecklerSpeakingPulse {
          0%, 100% { box-shadow: ${glowShadow}; }
          50% { box-shadow: 0 0 0 ${isSpeaking ? 4 : 3}px ${glowColor}, 0 0 ${isSpeaking ? 28 : 16}px ${glowColor}; }
        }
      `}</style>
    </div>
  )
}
