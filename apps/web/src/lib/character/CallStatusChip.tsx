'use client'

/**
 * Unified call status chip — a pill-shaped container grouping
 * [avatar] [state + timer] [end/cancel button] into one cohesive unit.
 *
 * Always renders (never returns null) so CSS transitions work smoothly.
 * Invisible (opacity 0, pointer-events none) during idle/ending states.
 */

import React from 'react'
import type { CharacterDefinition, ChatCallState } from './types'
import { MiniWaveform, AnimatedDots, formatTime } from '@/lib/voice'

export interface CallStatusChipProps {
  character: CharacterDefinition
  callState: ChatCallState
  size: 'compact' | 'medium' | 'standard'
  /** Show character name in the chip (default true; false for mobile strip) */
  showName?: boolean
}

const DANGER = '#ef4444'
const CALL_ACCENT = '#7c3aed'

const SIZE_CONFIG = {
  compact: { avatar: 16, fontSize: 11, timerFontSize: 10, buttonFontSize: 10, buttonPadding: '3px 8px', gap: 5 },
  medium: { avatar: 20, fontSize: 11, timerFontSize: 10, buttonFontSize: 10, buttonPadding: '4px 10px', gap: 6 },
  standard: { avatar: 24, fontSize: 13, timerFontSize: 12, buttonFontSize: 11, buttonPadding: '4px 10px', gap: 7 },
} as const

export function CallStatusChip({
  character,
  callState,
  size,
  showName = true,
}: CallStatusChipProps) {
  const { state, isSpeaking, isThinking, thinkingLabel, timeRemaining, onHangUp } = callState
  const isRinging = state === 'ringing'
  const isActive = state === 'active'
  const isError = state === 'error'
  const isVisible = isRinging || isActive || isError

  const cfg = SIZE_CONFIG[size]
  const headerName = character.nativeDisplayName ?? character.displayName

  return (
    <div
      data-component="call-status-chip"
      data-size={size}
      data-state={state}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: cfg.gap,
        background: 'rgba(109, 40, 217, 0.06)',
        border: '1px solid rgba(109, 40, 217, 0.12)',
        borderRadius: cfg.avatar,
        padding: `3px ${cfg.gap}px 3px 3px`,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'scale(1)' : 'scale(0.92)',
        transition: 'opacity 0.25s ease, transform 0.25s ease',
        pointerEvents: isVisible ? 'auto' : 'none',
      }}
    >
      {/* Avatar with ring pulse / speaking glow */}
      <div
        style={{
          width: cfg.avatar,
          height: cfg.avatar,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          boxShadow: isRinging
            ? '0 0 0 2px rgba(109, 40, 217, 0.4), 0 0 8px rgba(109, 40, 217, 0.3)'
            : isActive && isSpeaking
              ? '0 0 0 2px rgba(109, 40, 217, 0.5), 0 0 8px rgba(109, 40, 217, 0.3)'
              : 'none',
          animation: isRinging ? 'ringPulse 2s ease-out infinite' : undefined,
          transition: 'box-shadow 0.3s ease',
        }}
      >
        <img
          src={character.profileImage}
          alt={character.displayName}
          style={{
            width: cfg.avatar,
            height: cfg.avatar,
            borderRadius: '50%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      </div>

      {/* State content */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
        {isActive && isThinking ? (
          // Thinking state
          <span style={{
            fontSize: cfg.fontSize,
            fontWeight: 600,
            color: CALL_ACCENT,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{ fontSize: cfg.fontSize - 1 }}>📜</span>
            <span>{thinkingLabel || 'Thinking'}<AnimatedDots /></span>
          </span>
        ) : isActive ? (
          // Active: optional name + waveform + timer
          <>
            {showName && (
              <span style={{ fontWeight: 600, fontSize: cfg.fontSize, color: '#1e293b' }}>
                {headerName}
              </span>
            )}
            <MiniWaveform isDark={false} active={isSpeaking} />
            {timeRemaining !== null && timeRemaining !== undefined && (
              <span
                data-element="call-timer"
                style={{
                  fontSize: cfg.timerFontSize,
                  fontVariantNumeric: 'tabular-nums',
                  fontFamily: 'monospace',
                  color: timeRemaining <= 15 ? DANGER : '#94a3b8',
                  fontWeight: timeRemaining <= 15 ? 700 : 400,
                }}
              >
                {formatTime(timeRemaining)}
              </span>
            )}
          </>
        ) : isRinging ? (
          // Ringing: optional name + "Calling..."
          <>
            {showName && (
              <span style={{ fontWeight: 600, fontSize: cfg.fontSize, color: '#1e293b' }}>
                {headerName}
              </span>
            )}
            <span style={{ fontSize: cfg.fontSize - 1, color: '#94a3b8', fontStyle: 'italic' }}>
              Calling...
            </span>
          </>
        ) : isError ? (
          // Error: just label
          <span style={{ fontSize: cfg.fontSize, color: DANGER, fontWeight: 600 }}>
            Error
          </span>
        ) : null}
      </div>

      {/* End/Cancel button */}
      <button
        data-action="hang-up-chip"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onHangUp}
        style={{
          border: 'none',
          background: DANGER,
          color: '#fff',
          cursor: 'pointer',
          fontSize: cfg.buttonFontSize,
          fontWeight: 600,
          lineHeight: 1,
          padding: cfg.buttonPadding,
          borderRadius: cfg.avatar / 2,
          whiteSpace: 'nowrap',
          flexShrink: 0,
        }}
      >
        {isRinging ? 'Cancel' : 'End'}
      </button>
    </div>
  )
}
