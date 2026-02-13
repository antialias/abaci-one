'use client'

import { useEffect, useRef } from 'react'
import type { CallState } from './useRealtimeVoice'
import { numberToScreenX } from '../numberLineTicks'

interface PhoneCallOverlayProps {
  number: number
  state: CallState
  timeRemaining: number | null
  error: string | null
  transferTarget: number | null
  conferenceNumbers: number[]
  currentSpeaker: number | null
  isSpeaking: boolean
  onHangUp: () => void
  onRemoveFromCall: (number: number) => void
  onRetry: () => void
  onDismiss: () => void
  containerWidth: number
  containerHeight: number
  isDark: boolean
  /** Ref to the container div for call boxes — positioned by the draw loop */
  callBoxContainerRef: React.RefObject<HTMLDivElement | null>
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString()
  return n.toPrecision(6)
}

/** Compact waveform bars for call box speaking indicator */
function MiniWaveform({ isDark, active }: { isDark: boolean; active: boolean }) {
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
            animation: active ? `waveBarMini 0.6s ease-in-out ${i * 0.12}s infinite alternate` : 'none',
            height: active ? undefined : 4,
            transition: 'background-color 0.2s',
          }}
        />
      ))}
    </div>
  )
}

/** Per-number call box pill */
function CallBox({
  num,
  isCurrentSpeaker,
  isSpeaking,
  canRemove,
  onRemove,
  isDark,
}: {
  num: number
  isCurrentSpeaker: boolean
  isSpeaking: boolean
  canRemove: boolean
  onRemove: () => void
  isDark: boolean
}) {
  const speaking = isCurrentSpeaker && isSpeaking
  console.log('[CallBox] num=%s isCurrentSpeaker=%s isSpeaking=%s speaking=%s', num, isCurrentSpeaker, isSpeaking, speaking)
  const accentColor = isDark ? '#a855f7' : '#7c3aed'
  const textColor = isDark ? '#f3f4f6' : '#1f2937'
  const bg = isDark ? 'rgba(20, 20, 30, 0.85)' : 'rgba(255, 255, 255, 0.85)'

  return (
    <div
      data-component="call-box"
      data-call-box-number={String(num)}
      style={{
        position: 'absolute',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 22,
        backgroundColor: bg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: speaking
          ? `0 0 12px ${isDark ? 'rgba(168, 85, 247, 0.5)' : 'rgba(109, 40, 217, 0.35)'}, 0 4px 16px rgba(0, 0, 0, 0.2)`
          : isDark
            ? '0 4px 16px rgba(0, 0, 0, 0.4)'
            : '0 4px 16px rgba(0, 0, 0, 0.1)',
        border: speaking
          ? `2px solid ${accentColor}`
          : `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        pointerEvents: 'auto',
        transition: 'box-shadow 0.2s, border-color 0.2s',
        whiteSpace: 'nowrap',
        animation: 'fadeInUp 0.2s ease-out',
        // Positioned by updateCallBoxPositions; transform set there too
        willChange: 'left, top',
      }}
    >
      <span
        data-element="call-box-number"
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: textColor,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {formatNumber(num)}
      </span>

      <MiniWaveform isDark={isDark} active={speaking} />

      {canRemove && (
        <button
          data-action="remove-from-call"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 22,
            height: 22,
            padding: 0,
            border: 'none',
            borderRadius: '50%',
            backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
            color: isDark ? '#9ca3af' : '#6b7280',
            fontSize: 14,
            lineHeight: 1,
            cursor: 'pointer',
          }}
          aria-label={`Remove ${formatNumber(num)} from call`}
        >
          ✕
        </button>
      )}
    </div>
  )
}

/** Pulsing ring animation */
function RingAnimation({ isDark }: { isDark: boolean }) {
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

const MIN_BOX_GAP = 8 // minimum pixels between adjacent call boxes

/**
 * Position call box DOM elements at their number's screen-X position,
 * resolving overlaps so boxes never stack on top of each other.
 *
 * Called from the draw() rAF loop for smooth pan/zoom tracking.
 */
export function updateCallBoxPositions(
  container: HTMLDivElement,
  center: number,
  pixelsPerUnit: number,
  canvasWidth: number,
  canvasHeight: number,
) {
  const children = container.children
  const topY = canvasHeight / 2 - 80

  // 1. Gather boxes with their natural X and measured width
  const boxes: { el: HTMLElement; naturalX: number; width: number; x: number }[] = []
  for (let i = 0; i < children.length; i++) {
    const el = children[i] as HTMLElement
    const numStr = el.dataset.callBoxNumber
    if (!numStr) continue
    const num = Number(numStr)
    if (!isFinite(num)) continue

    const naturalX = numberToScreenX(num, center, pixelsPerUnit, canvasWidth)
    // Use measured width (el.offsetWidth), falling back to estimate
    const width = el.offsetWidth || 130
    boxes.push({ el, naturalX, width, x: naturalX })
  }

  if (boxes.length === 0) return

  // 2. Sort by natural screen-X position (left to right)
  boxes.sort((a, b) => a.naturalX - b.naturalX)

  // 3. Left-to-right sweep: push boxes right to resolve overlaps
  for (let i = 1; i < boxes.length; i++) {
    const prev = boxes[i - 1]
    const curr = boxes[i]
    const minCenter = prev.x + prev.width / 2 + MIN_BOX_GAP + curr.width / 2
    if (curr.x < minCenter) {
      curr.x = minCenter
    }
  }

  // 4. Re-center the group: shift all boxes so the group's center of
  //    displacement stays as close to its natural center as possible
  const naturalCenter = boxes.reduce((s, b) => s + b.naturalX, 0) / boxes.length
  const resolvedCenter = boxes.reduce((s, b) => s + b.x, 0) / boxes.length
  const shift = naturalCenter - resolvedCenter
  for (const b of boxes) b.x += shift

  // 5. Right-to-left sweep: if shifting caused new overlaps on the left, fix them
  for (let i = boxes.length - 2; i >= 0; i--) {
    const curr = boxes[i]
    const next = boxes[i + 1]
    const maxCenter = next.x - next.width / 2 - MIN_BOX_GAP - curr.width / 2
    if (curr.x > maxCenter) {
      curr.x = maxCenter
    }
  }

  // 6. Clamp to canvas bounds and apply
  for (const b of boxes) {
    const halfW = b.width / 2
    b.x = Math.max(halfW, Math.min(canvasWidth - halfW, b.x))

    b.el.style.left = `${b.x}px`
    b.el.style.top = `${topY}px`
    b.el.style.transform = 'translate(-50%, -100%)'
  }
}

export function PhoneCallOverlay({
  number,
  state,
  timeRemaining,
  error,
  transferTarget,
  conferenceNumbers,
  currentSpeaker,
  isSpeaking,
  onHangUp,
  onRemoveFromCall,
  onRetry,
  onDismiss,
  containerWidth,
  containerHeight,
  isDark,
  callBoxContainerRef,
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

  const isTransient = state === 'ringing' || state === 'ending' || state === 'transferring' || state === 'error'
  const overlayWidth = Math.min(280, containerWidth - 32)
  const overlayLeft = (containerWidth - overlayWidth) / 2
  const overlayTop = Math.max(40, (containerHeight - 300) / 2)

  return (
    <>
      {/* Active state: timer bar + per-number call boxes */}
      {state === 'active' && (
        <>
          {/* Timer bar — pinned to top center */}
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

          {/* Call box container — children positioned by updateCallBoxPositions */}
          <div
            ref={callBoxContainerRef as React.RefObject<HTMLDivElement>}
            data-element="call-box-container"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              zIndex: 12,
            }}
          >
            {conferenceNumbers.map(num => (
              <CallBox
                key={num}
                num={num}
                isCurrentSpeaker={currentSpeaker === num}
                isSpeaking={isSpeaking}
                canRemove={conferenceNumbers.length > 1}
                onRemove={() => onRemoveFromCall(num)}
                isDark={isDark}
              />
            ))}
          </div>
        </>
      )}

      {/* Transient states: centered floating card (no backdrop) */}
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
              <div
                data-element="calling-label"
                style={{
                  fontSize: 14,
                  color: subtextColor,
                  marginBottom: 4,
                }}
              >
                Calling...
              </div>
              <div
                data-element="calling-number"
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: textColor,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {formatNumber(number)}
              </div>
              <RingAnimation isDark={isDark} />
              <button
                data-action="hang-up-ringing"
                onClick={onHangUp}
                style={{
                  marginTop: 12,
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
              <div style={{ fontSize: 24, marginBottom: 8 }}>
                👋
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: textColor }}>
                {formatNumber(number)} hung up
              </div>
              <div style={{ fontSize: 13, color: subtextColor, marginTop: 4 }}>
                Great chat!
              </div>
            </div>
          )}

          {state === 'transferring' && transferTarget !== null && (
            <div data-element="transferring-message" style={{ padding: '20px 0' }}>
              <div style={{ fontSize: 14, color: subtextColor, marginBottom: 4 }}>
                {formatNumber(number)} is transferring you to...
              </div>
              <div
                style={{
                  fontSize: 36,
                  fontWeight: 700,
                  color: accentColor,
                  fontVariantNumeric: 'tabular-nums',
                  animation: 'transferPulse 1s ease-in-out infinite',
                }}
              >
                {formatNumber(transferTarget)}
              </div>
              <RingAnimation isDark={isDark} />
            </div>
          )}

          {state === 'error' && (
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
                Couldn&apos;t reach {formatNumber(number)}
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
                    backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                    border: 'none',
                    borderRadius: 22,
                    cursor: 'pointer',
                  }}
                >
                  Close
                </button>
              </div>
            </>
          )}
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
        @keyframes transferPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.05); }
        }
      `}</style>
    </>
  )
}
