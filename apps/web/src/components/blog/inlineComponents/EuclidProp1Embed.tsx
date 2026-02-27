'use client'

import dynamic from 'next/dynamic'

const EuclidCanvas = dynamic(
  () => import('@/components/toys/euclid/EuclidCanvas').then((m) => m.EuclidCanvas),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: '100%',
          height: 520,
          background: '#0d1117',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#4b5563',
          fontFamily: 'monospace',
          fontSize: 14,
        }}
      >
        Loading construction…
      </div>
    ),
  }
)

export function EuclidProp1Embed() {
  return (
    <figure
      style={{
        margin: '2.5rem 0',
        border: '1px solid #1f2937',
        borderRadius: 12,
        overflow: 'hidden',
        background: '#0d1117',
      }}
    >
      <div style={{ width: '100%', height: 520, position: 'relative' }}>
        {/* disableAudio prevents auto-play narration on page load; user can enable via speaker button */}
        <EuclidCanvas propositionId={1} disableAudio />
      </div>
      <figcaption
        style={{
          padding: '0.75rem 1.25rem',
          borderTop: '1px solid #1f2937',
          color: '#6b7280',
          fontSize: 13,
          fontStyle: 'italic',
          lineHeight: 1.5,
        }}
      >
        <strong style={{ color: '#9ca3af', fontStyle: 'normal' }}>
          Euclid, Book I, Proposition 1
        </strong>{' '}
        — Construct an equilateral triangle on a given line segment. Use the compass tool to draw
        two circles, then the straightedge to connect their intersection. The tutorial will guide
        you through each step.
      </figcaption>
    </figure>
  )
}
