'use client'

/**
 * Generic phone call overlay UI — shared across all voice-call consumers.
 *
 * Renders:
 *  - Ringing state: caller label + ring animation + hang up button
 *  - Active state: timer bar + hang up button + optional children
 *  - Ending state: goodbye message
 *  - Error state: error message + retry/dismiss buttons
 *
 * Number-line wraps this and adds its domain-specific conference UI.
 * Euclid uses this directly with a Greek-themed icon.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { CallState } from './types'

export interface PhoneCallOverlayProps {
  /** Display name for the caller (e.g. "5", "Euclid") */
  callerLabel: string
  /** Optional icon/emoji for the caller (text-based — for number-line style callers) */
  callerIcon?: ReactNode
  /** Optional profile image URL — when set, renders a featured photo (like an iPhone call screen) */
  callerImage?: string
  state: CallState
  timeRemaining: number | null
  error: string | null
  errorCode: string | null
  isSpeaking: boolean
  onHangUp: () => void
  onRetry: () => void
  onDismiss: () => void
  isDark: boolean
  /** Container dimensions for positioning */
  containerWidth: number
  containerHeight: number
  /** Optional children rendered in the active state (e.g. conference call boxes) */
  children?: ReactNode
  /** When true, shows a "consulting scrolls" indicator (e.g. Euclid's think_hard) */
  isThinking?: boolean
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Compact waveform bars for speaking indicator */
export function MiniWaveform({ isDark, active }: { isDark: boolean; active: boolean }) {
  const barColor = isDark ? 'rgba(168, 85, 247, 0.9)' : 'rgba(109, 40, 217, 0.9)'
  const dimColor = isDark ? 'rgba(168, 85, 247, 0.3)' : 'rgba(109, 40, 217, 0.3)'

  return (
    <div
      data-element="mini-waveform"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        height: 20,
      }}
    >
      {Array.from({ length: 3 }, (_, i) => (
        <div
          key={i}
          style={{
            width: 3,
            borderRadius: 1.5,
            backgroundColor: active ? barColor : dimColor,
            animation: active
              ? `waveBarMini 0.6s ease-in-out ${i * 0.12}s infinite alternate`
              : 'none',
            height: active ? undefined : 4,
            transition: 'background-color 0.2s',
          }}
        />
      ))}
    </div>
  )
}

/** Pulsing ring animation */
export function RingAnimation({ isDark }: { isDark: boolean }) {
  const color = isDark ? 'rgba(168, 85, 247, 0.4)' : 'rgba(109, 40, 217, 0.3)'

  return (
    <div
      data-element="ring-animation"
      style={{
        width: 80,
        height: 80,
        position: 'relative',
        margin: '16px auto',
      }}
    >
      {[0, 0.4, 0.8].map((delay, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${color}`,
            animation: `ringPulse 2s ease-out ${delay}s infinite`,
          }}
        />
      ))}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
      >
        📞
      </div>
    </div>
  )
}

/** Profile image at a given size with circular crop and optional speaking ring */
function CallerPhoto({
  src,
  alt,
  size,
  speaking,
  isDark,
}: {
  src: string
  alt: string
  size: number
  speaking?: boolean
  isDark: boolean
}) {
  const ringColor = isDark ? 'rgba(168, 85, 247, 0.7)' : 'rgba(109, 40, 217, 0.5)'
  return (
    <div
      data-element="caller-photo"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        boxShadow: speaking
          ? `0 0 0 3px ${ringColor}, 0 0 12px ${ringColor}`
          : '0 2px 8px rgba(0,0,0,0.15)',
        transition: 'box-shadow 0.3s ease',
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
    </div>
  )
}

/** Animated "..." that cycles through dot counts */
function AnimatedDots() {
  const [count, setCount] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setCount((c) => (c + 1) % 4), 450)
    return () => clearInterval(id)
  }, [])
  return <span style={{ width: 14, display: 'inline-block' }}>{'.'.repeat(count)}</span>
}

export function PhoneCallOverlay({
  callerLabel,
  callerIcon,
  callerImage,
  state,
  timeRemaining,
  error,
  errorCode,
  isSpeaking,
  onHangUp,
  onRetry,
  onDismiss,
  isDark,
  containerWidth,
  containerHeight,
  children,
  isThinking,
}: PhoneCallOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Dismiss on outside click (only in error state)
  useEffect(() => {
    if (state !== 'error') return
    function handlePointerDown(e: PointerEvent) {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [state, onDismiss])

  const bg = isDark ? 'rgba(20, 20, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)'
  const textColor = isDark ? '#f3f4f6' : '#1f2937'
  const subtextColor = isDark ? '#9ca3af' : '#6b7280'
  const accentColor = isDark ? '#a855f7' : '#7c3aed'
  const dangerColor = '#ef4444'

  const isTransient = state === 'ringing' || state === 'ending' || state === 'error'
  const overlayWidth = Math.min(280, containerWidth - 32)
  const overlayLeft = (containerWidth - overlayWidth) / 2
  const overlayTop = Math.max(40, (containerHeight - 300) / 2)

  return (
    <>
      {/* Active state: timer bar + children */}
      {state === 'active' && (
        <>
          {/* Timer bar */}
          <div
            data-element="call-timer-bar"
            style={{
              position: 'absolute',
              top: 8,
              left: '50%',
              transform: 'translateX(-50%)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '6px 16px',
              borderRadius: 20,
              backgroundColor: bg,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: isDark
                ? '0 4px 16px rgba(0, 0, 0, 0.4)'
                : '0 4px 16px rgba(0, 0, 0, 0.1)',
              zIndex: 13,
              pointerEvents: 'auto',
              animation: 'fadeInUp 0.2s ease-out',
            }}
          >
            {/* Caller identity in timer bar */}
            {callerImage ? (
              <CallerPhoto src={callerImage} alt={callerLabel} size={32} speaking={isSpeaking} isDark={isDark} />
            ) : (
              <>
                {isSpeaking && <MiniWaveform isDark={isDark} active={true} />}
                {callerIcon && (
                  <span style={{ fontSize: 14, display: 'flex', alignItems: 'center' }}>{callerIcon}</span>
                )}
              </>
            )}
            <span
              data-element="caller-label"
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: isThinking ? accentColor : textColor,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isThinking ? (
                <>
                  <span style={{ fontSize: 13 }}>📜</span>
                  <span>Consulting scrolls<AnimatedDots /></span>
                </>
              ) : (
                callerLabel
              )}
            </span>
            {timeRemaining !== null && (
              <span
                data-element="time-remaining"
                style={{
                  fontSize: 14,
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: 'monospace',
                  color: timeRemaining <= 15 ? dangerColor : subtextColor,
                  fontWeight: timeRemaining <= 15 ? 700 : 400,
                }}
              >
                {formatTime(timeRemaining)}
              </span>
            )}
            <button
              data-action="hang-up-active"
              onClick={onHangUp}
              style={{
                padding: '6px 16px',
                minHeight: 32,
                fontSize: 13,
                fontWeight: 600,
                color: '#fff',
                backgroundColor: dangerColor,
                border: 'none',
                borderRadius: 16,
                cursor: 'pointer',
              }}
            >
              End Call
            </button>
          </div>

          {/* Consumer-provided children (e.g. call boxes for number-line) */}
          {children}
        </>
      )}

      {/* Transient states: centered floating card */}
      {isTransient && (
        <div
          ref={overlayRef}
          data-component="phone-call-overlay"
          style={{
            position: 'absolute',
            left: overlayLeft,
            top: overlayTop,
            width: overlayWidth,
            padding: '24px 20px',
            borderRadius: 16,
            backgroundColor: bg,
            backdropFilter: 'blur(12px)',
            boxShadow: isDark
              ? '0 8px 32px rgba(0, 0, 0, 0.6)'
              : '0 8px 32px rgba(0, 0, 0, 0.15)',
            zIndex: 15,
            pointerEvents: 'auto',
            animation: 'fadeInUp 0.25s ease-out',
            textAlign: 'center',
          }}
        >
          {state === 'ringing' && (
            <>
              {callerImage ? (
                <>
                  {/* Featured profile photo with ring pulse behind it */}
                  <div
                    data-element="ringing-photo"
                    style={{
                      position: 'relative',
                      width: 120,
                      height: 120,
                      margin: '0 auto 16px',
                    }}
                  >
                    {[0, 0.4, 0.8].map((delay, i) => (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          inset: -8,
                          borderRadius: '50%',
                          border: `2px solid ${isDark ? 'rgba(168, 85, 247, 0.4)' : 'rgba(109, 40, 217, 0.3)'}`,
                          animation: `ringPulse 2s ease-out ${delay}s infinite`,
                        }}
                      />
                    ))}
                    <CallerPhoto src={callerImage} alt={callerLabel} size={120} isDark={isDark} />
                  </div>
                  <div
                    data-element="calling-label"
                    style={{ fontSize: 13, color: subtextColor, marginBottom: 4 }}
                  >
                    Calling...
                  </div>
                  <div
                    data-element="calling-target"
                    style={{ fontSize: 24, fontWeight: 700, color: textColor }}
                  >
                    {callerLabel}
                  </div>
                </>
              ) : (
                <>
                  <div
                    data-element="calling-label"
                    style={{ fontSize: 14, color: subtextColor, marginBottom: 4 }}
                  >
                    Calling...
                  </div>
                  <div
                    data-element="calling-target"
                    style={{ fontSize: 32, fontWeight: 700, color: textColor }}
                  >
                    {callerIcon && <span style={{ marginRight: 8 }}>{callerIcon}</span>}
                    {callerLabel}
                  </div>
                  <RingAnimation isDark={isDark} />
                </>
              )}
              <button
                data-action="hang-up-ringing"
                onClick={onHangUp}
                style={{
                  marginTop: 16,
                  padding: '12px 32px',
                  minHeight: 44,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: dangerColor,
                  border: 'none',
                  borderRadius: 22,
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Hang Up
              </button>
            </>
          )}

          {state === 'ending' && (
            <div data-element="ending-message" style={{ padding: '20px 0' }}>
              {callerImage ? (
                <div style={{ marginBottom: 12 }}>
                  <CallerPhoto src={callerImage} alt={callerLabel} size={72} isDark={isDark} />
                </div>
              ) : (
                <div style={{ fontSize: 24, marginBottom: 8 }}>
                  {callerIcon || '👋'}
                </div>
              )}
              <div style={{ fontSize: 16, fontWeight: 600, color: textColor }}>
                {callerLabel} hung up
              </div>
              <div style={{ fontSize: 13, color: subtextColor, marginTop: 4 }}>
                Great chat!
              </div>
            </div>
          )}

          {state === 'error' &&
            (() => {
              const isRetryable = errorCode !== 'quota_exceeded'
              return (
                <>
                  <div
                    data-element="error-title"
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      color: textColor,
                      marginBottom: 8,
                    }}
                  >
                    Couldn&apos;t reach {callerLabel}
                  </div>
                  <div
                    data-element="error-message"
                    style={{
                      fontSize: 13,
                      color: subtextColor,
                      marginBottom: 16,
                      lineHeight: 1.4,
                    }}
                  >
                    {error || 'Something went wrong'}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isRetryable && (
                      <button
                        data-action="retry-call"
                        onClick={onRetry}
                        style={{
                          flex: 1,
                          padding: '12px 16px',
                          minHeight: 44,
                          fontSize: 14,
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor: accentColor,
                          border: 'none',
                          borderRadius: 22,
                          cursor: 'pointer',
                        }}
                      >
                        Try Again
                      </button>
                    )}
                    <button
                      data-action="dismiss-error"
                      onClick={onDismiss}
                      style={{
                        flex: 1,
                        padding: '12px 16px',
                        minHeight: 44,
                        fontSize: 14,
                        fontWeight: 600,
                        color: textColor,
                        backgroundColor: isDark
                          ? 'rgba(255,255,255,0.1)'
                          : 'rgba(0,0,0,0.06)',
                        border: 'none',
                        borderRadius: 22,
                        cursor: 'pointer',
                      }}
                    >
                      Close
                    </button>
                  </div>
                </>
              )
            })()}
        </div>
      )}

      {/* Keyframe animations */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes ringPulse {
          0% { transform: scale(0.5); opacity: 1; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes waveBarMini {
          0% { height: 4px; }
          100% { height: 16px; }
        }
      `}</style>
    </>
  )
}
