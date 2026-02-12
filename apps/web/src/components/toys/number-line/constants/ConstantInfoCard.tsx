'use client'

import { useEffect, useRef, useState } from 'react'
import type { MathConstant } from './constantsData'
import { useTTS } from '@/hooks/useTTS'
import { useAudioManagerInstance } from '@/contexts/AudioManagerContext'
import { DEMO_AVAILABLE } from './demos/useConstantDemo'

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
  /** Called when user taps "Explore" to launch the constant's demo */
  onExplore?: (constantId: string) => void
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
  onExplore,
}: ConstantInfoCardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const audioManager = useAudioManagerInstance()

  // TTS: auto-speak on mount
  const speak = useTTS(`constant-${constant.id}`, {
    tone: 'Warmly explaining a math concept to a curious child.',
    say: { en: constant.ttsExplanation },
  })

  useEffect(() => {
    console.log(`[ConstantInfoCard] 🟢 MOUNT effect — calling speak() for "${constant.id}"`)
    speak()
    return () => {
      console.log(`[ConstantInfoCard] 🔴 CLEANUP — calling audioManager.stop() for "${constant.id}"`)
      // Cancel in-flight audio on unmount (prevents React strict mode
      // double-mount from producing two overlapping narrations)
      audioManager.stop()
    }
  }, [speak, audioManager])

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
  const rawTop = placeAbove ? Math.max(CARD_PAD, centerY - 140) : centerY + 20
  // Clamp so the card never extends past the container bottom.
  // Reserve at least 200px for the card so the Explore button is visible.
  const top = Math.min(rawTop, containerHeight - CARD_PAD - 200)

  const hasImages = !!(constant.metaphorImage && constant.mathImage)
  const [imageTab, setImageTab] = useState<'metaphor' | 'math'>('metaphor')

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
        maxHeight: containerHeight - top - CARD_PAD,
        overflowY: 'auto',
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

      {/* Illustration with tab toggle */}
      {hasImages && (
        <div data-element="constant-illustration" style={{ marginBottom: 8 }}>
          <div
            data-element="illustration-tabs"
            style={{
              display: 'flex',
              gap: 4,
              marginBottom: 6,
            }}
          >
            {(['metaphor', 'math'] as const).map((tab) => {
              const active = imageTab === tab
              return (
                <button
                  key={tab}
                  data-action={`illustration-tab-${tab}`}
                  onClick={() => setImageTab(tab)}
                  style={{
                    flex: 1,
                    padding: '3px 0',
                    fontSize: 11,
                    fontWeight: active ? 600 : 400,
                    color: active ? (isDark ? '#1f2937' : '#fff') : subtextColor,
                    backgroundColor: active ? symbolColor : 'transparent',
                    border: `1px solid ${active ? symbolColor : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)')}`,
                    borderRadius: 4,
                    cursor: 'pointer',
                  }}
                >
                  {tab === 'metaphor' ? 'Imagine' : 'Math'}
                </button>
              )
            })}
          </div>
          <ThemedImage
            baseSrc={(imageTab === 'metaphor' ? constant.metaphorImage : constant.mathImage)!}
            isDark={isDark}
            alt={`${constant.name} — ${imageTab === 'metaphor' ? 'metaphor' : 'math'} illustration`}
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 6,
              objectFit: 'cover',
            }}
          />
        </div>
      )}

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

      {/* Explore button — only for constants with demos */}
      {onExplore && DEMO_AVAILABLE.has(constant.id) && (
        <button
          data-action="explore-constant"
          onClick={() => {
            onExplore(constant.id)
            onDismiss()
          }}
          style={{
            marginTop: 8,
            padding: '10px 12px',
            minHeight: 44,
            fontSize: 13,
            fontWeight: 600,
            color: isDark ? '#1f2937' : '#fff',
            backgroundColor: symbolColor,
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Explore
        </button>
      )}

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

function ThemedImage({
  baseSrc,
  isDark,
  alt,
  style,
}: {
  baseSrc: string
  isDark: boolean
  alt: string
  style: React.CSSProperties
}) {
  const [useFallback, setUseFallback] = useState(false)

  useEffect(() => {
    setUseFallback(false)
  }, [isDark])

  const theme = isDark ? 'dark' : 'light'
  const themedSrc = !useFallback
    ? baseSrc.replace('.png', `-${theme}.png`)
    : baseSrc

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      data-element="constant-illustration-image"
      src={themedSrc}
      alt={alt}
      style={style}
      onError={() => {
        if (!useFallback) setUseFallback(true)
      }}
    />
  )
}

function formatConstantValue(value: number): string {
  // Show enough digits to be interesting but not overwhelming
  if (Number.isInteger(value)) return value.toString()
  const str = value.toPrecision(10)
  // Remove trailing zeros after decimal point
  return str.replace(/\.?0+$/, '')
}
