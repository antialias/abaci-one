'use client'

import { useEffect, useRef } from 'react'
import type { MathConstant } from './constantsData'
import { useTTS } from '@/hooks/useTTS'

interface ConstantInfoCardProps {
  constant: MathConstant
  /** Screen X position of the constant on the canvas (CSS px) */
  screenX: number
  /** Width of the canvas container (CSS px) */
  containerWidth: number
  /** Height of the canvas container (CSS px) */
  containerHeight: number
  /** Center Y of the axis line (CSS px) */
  centerY: number
  isDark: boolean
  onDismiss: () => void
}

const CARD_WIDTH = 220
const CARD_PAD = 12

export function ConstantInfoCard({
  constant,
  screenX,
  containerWidth,
  containerHeight,
  centerY,
  isDark,
  onDismiss,
}: ConstantInfoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)

  // TTS: auto-speak on mount
  const speak = useTTS(`constant-${constant.id}`, {
    tone: 'Warmly explaining a math concept to a curious child.',
    say: { en: constant.ttsExplanation },
  })

  useEffect(() => {
    speak()
  }, [speak])

  // Dismiss on click outside
  useEffect(() => {
    function handlePointerDown(e: PointerEvent) {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    // Use a small delay so the tap that opened the card doesn't immediately close it
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    }, 50)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onDismiss])

  // Position: clamp horizontally, place above or below axis
  const clampedX = Math.max(CARD_PAD, Math.min(containerWidth - CARD_WIDTH - CARD_PAD, screenX - CARD_WIDTH / 2))
  const spaceAbove = centerY
  const spaceBelow = containerHeight - centerY
  const placeAbove = spaceAbove > spaceBelow
  const top = placeAbove ? Math.max(CARD_PAD, centerY - 140) : centerY + 20

  const bg = isDark ? 'rgba(30, 30, 40, 0.92)' : 'rgba(255, 255, 255, 0.92)'
  const textColor = isDark ? '#f3f4f6' : '#1f2937'
  const subtextColor = isDark ? '#9ca3af' : '#6b7280'
  const symbolColor = isDark ? '#f59e0b' : '#4338ca'

  return (
    <div
      ref={cardRef}
      data-component="constant-info-card"
      style={{
        position: 'absolute',
        left: clampedX,
        top,
        width: CARD_WIDTH,
        padding: '12px 14px',
        borderRadius: 10,
        backgroundColor: bg,
        backdropFilter: 'blur(8px)',
        boxShadow: isDark
          ? '0 4px 20px rgba(0,0,0,0.5)'
          : '0 4px 20px rgba(0,0,0,0.12)',
        zIndex: 10,
        pointerEvents: 'auto',
        animation: 'fadeInUp 0.2s ease-out',
      }}
    >
      {/* MathML symbol */}
      <div
        data-element="constant-symbol"
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: symbolColor,
          lineHeight: 1.3,
          marginBottom: 6,
        }}
        dangerouslySetInnerHTML={{ __html: constant.mathml }}
      />

      <div
        data-element="constant-name"
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: textColor,
          marginBottom: 2,
        }}
      >
        {constant.name}
      </div>

      <div
        data-element="constant-value"
        style={{
          fontSize: 12,
          fontFamily: 'monospace',
          color: subtextColor,
          marginBottom: 6,
        }}
      >
        {formatConstantValue(constant.value)}
      </div>

      <div
        data-element="constant-description"
        style={{
          fontSize: 12,
          color: subtextColor,
          lineHeight: 1.4,
        }}
      >
        {constant.description}
      </div>

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function formatConstantValue(value: number): string {
  // Show enough digits to be interesting but not overwhelming
  if (Number.isInteger(value)) return value.toString()
  const str = value.toPrecision(10)
  // Remove trailing zeros after decimal point
  return str.replace(/\.?0+$/, '')
}
