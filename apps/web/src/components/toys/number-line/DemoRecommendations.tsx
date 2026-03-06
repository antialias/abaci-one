import { DEMO_RECOMMENDATIONS } from './talkToNumber/explorationRegistry'
import { EXPLORATION_DISPLAY } from './talkToNumber/explorationRegistry'
import { MATH_CONSTANTS } from './constants/constantsData'

const DEMO_DISPLAY = EXPLORATION_DISPLAY

interface DemoRecommendationsProps {
  constantId: string
  isDark: boolean
  onExplore: (id: string) => void
}

export function DemoRecommendations({ constantId, isDark, onExplore }: DemoRecommendationsProps) {
  const recommendations = DEMO_RECOMMENDATIONS[constantId] ?? []
  if (recommendations.length === 0) return null

  return (
    <div
      data-element="demo-recommendations"
      style={{
        position: 'absolute',
        bottom: 'max(76px, calc(env(safe-area-inset-bottom, 0px) + 76px))',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        pointerEvents: 'none',
      }}
    >
      <div
        data-element="demo-recommendations-label"
        style={{
          fontSize: 11,
          fontWeight: 500,
          fontFamily: 'system-ui, sans-serif',
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.35)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        Explore next
      </div>
      <div
        data-element="demo-recommendations-cards"
        style={{
          display: 'flex',
          gap: 10,
          pointerEvents: 'auto',
          width: '100%',
          padding: '0 12px',
          boxSizing: 'border-box',
        }}
      >
        {recommendations.map((id) => {
          const d = DEMO_DISPLAY[id]
          if (!d) return null
          const mc = MATH_CONSTANTS.find((c) => c.id === id)
          const themeSuffix = isDark ? '-dark' : '-light'
          const imgSrc = mc?.metaphorImage?.replace('.png', `${themeSuffix}.png`)
          return (
            <button
              key={id}
              data-action={`explore-${id}`}
              onClick={() => onExplore(id)}
              style={{
                position: 'relative',
                flex: 1,
                height: 140,
                padding: 0,
                border: 'none',
                borderRadius: 14,
                cursor: 'pointer',
                overflow: 'hidden',
                background: isDark ? '#1a1a2e' : '#e8e8f0',
              }}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt=""
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 48,
                    opacity: 0.3,
                    fontFamily: 'system-ui, sans-serif',
                  }}
                >
                  {d.symbol}
                </div>
              )}
              {/* Gradient scrim for text legibility */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: '70%',
                  background:
                    'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.35) 50%, transparent 100%)',
                  pointerEvents: 'none',
                }}
              />
              {/* Text overlay */}
              <div
                style={{
                  position: 'absolute',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 2,
                }}
              >
                <span
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    fontFamily: 'system-ui, sans-serif',
                    color: '#fff',
                    lineHeight: 1,
                    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  }}
                >
                  {d.symbol}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    fontFamily: 'system-ui, sans-serif',
                    color: 'rgba(255,255,255,0.8)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                  }}
                >
                  {d.name}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
