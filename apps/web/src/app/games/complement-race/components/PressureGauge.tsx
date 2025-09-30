'use client'

interface PressureGaugeProps {
  pressure: number // 0-150 PSI
}

export function PressureGauge({ pressure }: PressureGaugeProps) {
  // Calculate needle angle (-90deg at 0 PSI to +90deg at 150 PSI)
  const maxPressure = 150
  const angle = ((pressure / maxPressure) * 180) - 90

  // Get pressure color
  const getPressureColor = (): string => {
    if (pressure < 50) return '#ef4444' // Red (low)
    if (pressure < 100) return '#f59e0b' // Orange (medium)
    return '#10b981' // Green (high)
  }

  const color = getPressureColor()

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
        viewBox="0 0 200 120"
        style={{
          width: '100%',
          height: 'auto',
          marginBottom: '8px'
        }}
      >
        {/* Background arc */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
          strokeLinecap="round"
        />

        {/* Colored arc based on pressure */}
        <path
          d="M 20 100 A 80 80 0 0 1 180 100"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(pressure / maxPressure) * 251} 251`}
          style={{
            transition: 'stroke 0.3s ease-out, stroke-dasharray 0.2s ease-out',
            filter: pressure > 50 ? `drop-shadow(0 0 6px ${color})` : 'none'
          }}
        />

        {/* Tick marks */}
        {[0, 50, 100, 150].map((psi, index) => {
          const tickAngle = ((psi / maxPressure) * 180) - 90
          const tickRad = (tickAngle * Math.PI) / 180
          const x1 = 100 + Math.cos(tickRad) * 70
          const y1 = 100 + Math.sin(tickRad) * 70
          const x2 = 100 + Math.cos(tickRad) * 80
          const y2 = 100 + Math.sin(tickRad) * 80

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
                x={100 + Math.cos(tickRad) * 60}
                y={100 + Math.sin(tickRad) * 60 + 4}
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

        {/* Needle */}
        <line
          x1="100"
          y1="100"
          x2={100 + Math.cos((angle * Math.PI) / 180) * 70}
          y2={100 + Math.sin((angle * Math.PI) / 180) * 70}
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          style={{
            transition: 'all 0.2s ease-out',
            filter: `drop-shadow(0 2px 3px ${color})`
          }}
        />
      </svg>

      {/* Digital readout */}
      <div style={{
        textAlign: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        color
      }}>
        {Math.round(pressure)} <span style={{ fontSize: '12px' }}>PSI</span>
      </div>
    </div>
  )
}