'use client'

import type { PrimeTourStop } from './primeTourStops'

interface PrimeTourOverlayProps {
  stop: PrimeTourStop
  stopIndex: number
  totalStops: number
  isDark: boolean
  onNext: () => void
  onPrev: () => void
  onClose: () => void
}

export function PrimeTourOverlay({
  stop,
  stopIndex,
  totalStops,
  isDark,
  onNext,
  onPrev,
  onClose,
}: PrimeTourOverlayProps) {
  const isFirst = stopIndex === 0
  const isLast = stopIndex === totalStops - 1

  const bg = isDark ? 'rgba(30, 30, 40, 0.92)' : 'rgba(255, 255, 255, 0.92)'
  const textColor = isDark ? '#f3f4f6' : '#1f2937'
  const subtextColor = isDark ? '#9ca3af' : '#6b7280'
  const accentColor = isDark ? '#a78bfa' : '#7c3aed'

  return (
    <div
      data-component="prime-tour-overlay"
      style={{
        position: 'absolute',
        bottom: 'max(16px, env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(380px, calc(100% - 32px))',
        padding: '14px 16px 12px',
        borderRadius: 12,
        backgroundColor: bg,
        backdropFilter: 'blur(8px)',
        boxShadow: isDark
          ? '0 4px 24px rgba(0,0,0,0.5)'
          : '0 4px 24px rgba(0,0,0,0.12)',
        zIndex: 10,
        pointerEvents: 'auto',
        animation: 'fadeInUp 0.2s ease-out',
      }}
    >
      {/* Close button */}
      <button
        data-action="tour-close"
        onClick={onClose}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 44,
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 16,
          lineHeight: 1,
          color: subtextColor,
          backgroundColor: 'transparent',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          padding: 0,
        }}
        aria-label="Close tour"
      >
        ✕
      </button>

      {/* Blurb text */}
      <div
        data-element="tour-blurb"
        style={{
          fontSize: 13,
          lineHeight: 1.5,
          color: textColor,
          marginBottom: 12,
          paddingRight: 20,
        }}
      >
        {stop.blurb}
      </div>

      {/* Bottom row: prev arrow, step dots, next arrow */}
      <div
        data-element="tour-nav"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        {/* Prev button */}
        <button
          data-action="tour-prev"
          onClick={onPrev}
          disabled={isFirst}
          style={{
            fontSize: 22,
            color: isFirst ? (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)') : accentColor,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: isFirst ? 'default' : 'pointer',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            lineHeight: 1,
          }}
          aria-label="Previous stop"
        >
          ‹
        </button>

        {/* Step dots */}
        <div
          data-element="tour-step-dots"
          style={{
            display: 'flex',
            gap: 6,
            alignItems: 'center',
          }}
        >
          {Array.from({ length: totalStops }, (_, i) => (
            <div
              key={i}
              data-element="tour-dot"
              style={{
                width: i === stopIndex ? 8 : 6,
                height: i === stopIndex ? 8 : 6,
                borderRadius: '50%',
                backgroundColor: i === stopIndex
                  ? accentColor
                  : i < stopIndex
                    ? (isDark ? 'rgba(167, 139, 250, 0.5)' : 'rgba(124, 58, 237, 0.4)')
                    : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'),
                transition: 'all 0.2s ease',
              }}
            />
          ))}
        </div>

        {/* Next / Finish button */}
        <button
          data-action={isLast ? 'tour-finish' : 'tour-next'}
          onClick={onNext}
          style={{
            fontSize: isLast ? 13 : 22,
            fontWeight: isLast ? 600 : 400,
            color: accentColor,
            backgroundColor: 'transparent',
            border: 'none',
            cursor: 'pointer',
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            lineHeight: 1,
          }}
          aria-label={isLast ? 'Finish tour' : 'Next stop'}
        >
          {isLast ? 'Finish' : '›'}
        </button>
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
