'use client'

const BUGS = [
  { cx: 590, cy: 120, label: 'Race condition', anchor: 'start' },
  { cx: 610, cy: 200, label: 'Unexpected input', anchor: 'start' },
  { cx: 575, cy: 270, label: 'State boundary', anchor: 'start' },
  { cx: 120, cy: 155, label: 'Security edge case', anchor: 'end' },
  { cx: 135, cy: 245, label: 'Integer overflow', anchor: 'end' },
]

export function TestingCoverageGap() {
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
      <svg
        viewBox="0 0 760 340"
        style={{ width: '100%', height: 'auto', display: 'block' }}
        aria-label="Diagram showing the gap between what tests cover and all possible program states"
      >
        <defs>
          <radialGradient id="outerGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#1e2533" />
            <stop offset="100%" stopColor="#141b27" />
          </radialGradient>
          <radialGradient id="innerGrad" cx="45%" cy="48%" r="55%">
            <stop offset="0%" stopColor="#1e3a5f" />
            <stop offset="100%" stopColor="#172d4a" />
          </radialGradient>
        </defs>

        {/* Background */}
        <rect width="760" height="340" fill="#0d1117" />

        {/* Outer region — all possible program states */}
        <ellipse
          cx="375"
          cy="172"
          rx="338"
          ry="152"
          fill="url(#outerGrad)"
          stroke="#334155"
          strokeWidth="1.5"
        />

        {/* Outer label */}
        <text
          x="375"
          y="38"
          textAnchor="middle"
          fill="#64748b"
          fontSize="13"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.05em"
        >
          ALL POSSIBLE PROGRAM STATES
        </text>

        {/* Inner region — what tests cover */}
        <ellipse
          cx="345"
          cy="168"
          rx="178"
          ry="104"
          fill="url(#innerGrad)"
          stroke="#2563eb"
          strokeWidth="1.5"
          strokeDasharray="none"
        />

        {/* Checkmark + "Tests pass here" */}
        <text
          x="345"
          y="158"
          textAnchor="middle"
          fill="#60a5fa"
          fontSize="22"
          fontFamily="system-ui, sans-serif"
        >
          ✓
        </text>
        <text
          x="345"
          y="180"
          textAnchor="middle"
          fill="#93c5fd"
          fontSize="13"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
        >
          Tests pass here
        </text>
        <text
          x="345"
          y="198"
          textAnchor="middle"
          fill="#3b82f6"
          fontSize="11"
          fontFamily="system-ui, sans-serif"
        >
          your test suite covers this region
        </text>

        {/* "Bugs live here" label in the gap */}
        <text
          x="560"
          y="80"
          textAnchor="middle"
          fill="#f87171"
          fontSize="12"
          fontFamily="system-ui, sans-serif"
          fontWeight="600"
          letterSpacing="0.04em"
        >
          BUGS LIVE HERE
        </text>
        {/* Dashed bracket under "bugs live here" */}
        <line
          x1="520"
          y1="86"
          x2="600"
          y2="86"
          stroke="#991b1b"
          strokeWidth="1"
          strokeDasharray="3 3"
        />

        {/* Bug dots and labels */}
        {BUGS.map((bug) => (
          <g key={bug.label}>
            <circle cx={bug.cx} cy={bug.cy} r={5} fill="#ef4444" opacity={0.9} />
            <text
              x={bug.anchor === 'start' ? bug.cx + 12 : bug.cx - 12}
              y={bug.cy + 4}
              textAnchor={bug.anchor as 'start' | 'end'}
              fill="#fca5a5"
              fontSize="12"
              fontFamily="system-ui, sans-serif"
            >
              {bug.label}
            </text>
          </g>
        ))}

        {/* Arrow pointing from "bugs live here" to the gap region */}
        <line x1="540" y1="90" x2="545" y2="110" stroke="#7f1d1d" strokeWidth="1" />
        <polygon points="540,114 545,104 550,114" fill="#7f1d1d" />
      </svg>

      <figcaption
        style={{
          padding: '0.85rem 1.25rem',
          borderTop: '1px solid #1f2937',
          color: '#6b7280',
          fontSize: 13,
          fontStyle: 'italic',
          lineHeight: 1.6,
        }}
      >
        Testing demonstrates that your program works in the cases you thought to test. It cannot
        demonstrate correctness for the cases you did not. The gap between these two regions is
        where production bugs live — by definition, undiscovered until someone hits them.
      </figcaption>
    </figure>
  )
}
