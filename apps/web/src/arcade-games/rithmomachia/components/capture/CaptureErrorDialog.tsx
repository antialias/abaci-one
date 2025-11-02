import { animated, to, useSpring } from '@react-spring/web'

export interface CaptureErrorDialogProps {
  targetPos: { x: number; y: number }
  cellSize: number
  onClose: () => void
  closing: boolean
}

/**
 * Error notification when no capture is possible
 */
export function CaptureErrorDialog({
  targetPos,
  cellSize,
  onClose,
  closing,
}: CaptureErrorDialogProps) {
  const entranceSpring = useSpring({
    from: { opacity: 0, y: -20 },
    opacity: closing ? 0 : 1,
    y: closing ? -20 : 0,
    config: { tension: 300, friction: 25 },
  })

  return (
    <animated.g
      style={{
        opacity: entranceSpring.opacity,
      }}
      transform={to([entranceSpring.y], (y) => `translate(${targetPos.x}, ${targetPos.y + y})`)}
    >
      <foreignObject
        x={-cellSize * 1.8}
        y={-cellSize * 0.5}
        width={cellSize * 3.6}
        height={cellSize}
        style={{ overflow: 'visible' }}
      >
        <div
          style={{
            background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
            color: '#f1f5f9',
            padding: `${cellSize * 0.12}px ${cellSize * 0.18}px`,
            borderRadius: `${cellSize * 0.12}px`,
            fontSize: `${cellSize * 0.16}px`,
            fontWeight: 500,
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: `${cellSize * 0.15}px`,
            backdropFilter: 'blur(8px)',
            letterSpacing: '0.01em',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${cellSize * 0.1}px`,
              flex: 1,
            }}
          >
            <span
              style={{
                fontSize: `${cellSize * 0.2}px`,
                opacity: 0.7,
              }}
            >
              ⚠
            </span>
            <span>No valid relation</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            style={{
              padding: `${cellSize * 0.06}px ${cellSize * 0.12}px`,
              borderRadius: `${cellSize * 0.08}px`,
              border: 'none',
              background: 'rgba(148, 163, 184, 0.2)',
              color: '#cbd5e1',
              fontSize: `${cellSize * 0.13}px`,
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(148, 163, 184, 0.3)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(148, 163, 184, 0.2)'
            }}
          >
            OK
          </button>
        </div>
      </foreignObject>
    </animated.g>
  )
}
