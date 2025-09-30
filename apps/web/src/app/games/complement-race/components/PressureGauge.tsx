'use client'

import { useSpring, animated } from '@react-spring/web'

interface PressureGaugeProps {
  pressure: number // 0-150 PSI
}

export function PressureGauge({ pressure }: PressureGaugeProps) {
  const maxPressure = 150

  // Animate pressure value smoothly with spring physics
  const spring = useSpring({
    pressure,
    config: {
      tension: 120,
      friction: 14,
      clamp: false
    }
  })

  // Calculate needle angle - sweeps 180° from left to right
  // 0 PSI = 180° (pointing left), 150 PSI = 0° (pointing right)
  const angle = spring.pressure.to(p => 180 - (p / maxPressure) * 180)

  // Get pressure color (animated)
  const color = spring.pressure.to(p => {
    if (p < 50) return '#ef4444' // Red (low)
    if (p < 100) return '#f59e0b' // Orange (medium)
    return '#10b981' // Green (high)
  })

  return (
    <div style={{
      position: 'relative',
      background: 'rgba(255, 255, 255, 0.95)',
      padding: '16px',
      borderRadius: '12px',
      minWidth: '160px',
      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
    }}>
      {/* Title */}
      <div style={{
        fontSize: '12px',
        color: '#6b7280',
        marginBottom: '8px',
        fontWeight: 'bold',
        textAlign: 'center'
      }}>
        PRESSURE
      </div>

      {/* SVG Gauge */}
      <svg
        viewBox="0 0 210 130"
        style={{
          width: '100%',
          height: 'auto',
          marginBottom: '8px'
        }}
      >
        {/* Background arc - semicircle from left to right (bottom half) */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="8"
          strokeLinecap="round"
        />

        {/* Tick marks */}
        {[0, 50, 100, 150].map((psi, index) => {
          // Angle from 180° (left) to 0° (right)
          const tickAngle = 180 - (psi / maxPressure) * 180
          const tickRad = (tickAngle * Math.PI) / 180
          const x1 = 100 + Math.cos(tickRad) * 70
          const y1 = 100 - Math.sin(tickRad) * 70  // Subtract for SVG coords
          const x2 = 100 + Math.cos(tickRad) * 80
          const y2 = 100 - Math.sin(tickRad) * 80  // Subtract for SVG coords

          return (
            <g key={`tick-${index}`}>
              <line
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="#6b7280"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <text
                x={100 + Math.cos(tickRad) * 92}
                y={100 - Math.sin(tickRad) * 92 + 4}  // Subtract for SVG coords
                textAnchor="middle"
                fontSize="10"
                fill="#6b7280"
                fontWeight="600"
              >
                {psi}
              </text>
            </g>
          )
        })}

        {/* Center pivot */}
        <circle cx="100" cy="100" r="4" fill="#1f2937" />

        {/* Needle - animated */}
        <animated.line
          x1="100"
          y1="100"
          x2={angle.to(a => 100 + Math.cos((a * Math.PI) / 180) * 70)}
          y2={angle.to(a => 100 - Math.sin((a * Math.PI) / 180) * 70)}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            filter: color.to(c => `drop-shadow(0 2px 3px ${c})`)
          }}
        />
      </svg>

      {/* Digital readout - animated */}
      <animated.div style={{
        textAlign: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        color
      }}>
        {spring.pressure.to(p => Math.round(p))} <span style={{ fontSize: '12px' }}>PSI</span>
      </animated.div>
    </div>
  )
}