'use client'

import { useState } from 'react'
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
  const [active, setActive] = useState(false)

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
        {active ? (
          <EuclidCanvas propositionId={1} />
        ) : (
          <button
            onClick={() => setActive(true)}
            style={{
              width: '100%',
              height: '100%',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '1rem',
              padding: 0,
            }}
          >
            {/* Decorative SVG: compass arcs suggesting Prop 1 */}
            <svg
              viewBox="0 0 160 120"
              width="160"
              height="120"
              style={{ opacity: 0.35 }}
              aria-hidden="true"
            >
              <circle cx="52" cy="80" r="44" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeDasharray="4 3" />
              <circle cx="108" cy="80" r="44" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="4 3" />
              <line x1="52" y1="80" x2="108" y2="80" stroke="#e5e7eb" strokeWidth="1.5" />
              <circle cx="52" cy="80" r="3" fill="#60a5fa" />
              <circle cx="108" cy="80" r="3" fill="#f59e0b" />
              <circle cx="80" cy="42" r="3" fill="#34d399" />
              <line x1="52" y1="80" x2="80" y2="42" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.6" />
              <line x1="108" y1="80" x2="80" y2="42" stroke="#34d399" strokeWidth="1.5" strokeOpacity="0.6" />
            </svg>
            <span
              style={{
                color: '#9ca3af',
                fontSize: 14,
                fontFamily: 'system-ui, sans-serif',
                letterSpacing: '0.04em',
              }}
            >
              Try the construction
            </span>
          </button>
        )}
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
