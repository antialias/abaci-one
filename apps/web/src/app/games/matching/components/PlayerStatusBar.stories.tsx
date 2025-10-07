import type { Meta, StoryObj } from '@storybook/react'
import type React from 'react'
import { useEffect } from 'react'
import { css } from '../../../../../styled-system/css'
import { gamePlurals } from '../../../../utils/pluralization'

// Inject the celebration animations for Storybook
const celebrationAnimations = `
@keyframes gentle-pulse {
  0%, 100% {
    box-shadow: 0 0 0 2px white, 0 0 0 6px rgba(102, 126, 234, 0.3), 0 12px 32px rgba(0,0,0,0.1);
  }
  50% {
    box-shadow: 0 0 0 2px white, 0 0 0 6px rgba(102, 126, 234, 0.5), 0 12px 32px rgba(0,0,0,0.2);
  }
}

@keyframes gentle-bounce {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-3px);
  }
}

@keyframes gentle-sway {
  0%, 100% { transform: rotate(-2deg) scale(1); }
  50% { transform: rotate(2deg) scale(1.05); }
}

@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.03); }
}

@keyframes float {
  0%, 100% { transform: translateY(0px); }
  50% { transform: translateY(-6px); }
}

@keyframes turn-entrance {
  0% {
    transform: scale(0.8) rotate(-10deg);
    opacity: 0.6;
  }
  50% {
    transform: scale(1.1) rotate(5deg);
    opacity: 1;
  }
  100% {
    transform: scale(1.08) rotate(0deg);
    opacity: 1;
  }
}

@keyframes streak-pulse {
  0%, 100% {
    opacity: 0.9;
    transform: scale(1);
  }
  50% {
    opacity: 1;
    transform: scale(1.05);
  }
}

@keyframes great-celebration {
  0% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #22c55e40, 0 12px 32px rgba(0,0,0,0.2);
  }
  50% {
    transform: scale(1.12) translateY(-6px);
    box-shadow: 0 0 0 2px white, 0 0 0 8px #22c55e60, 0 15px 35px rgba(34,197,94,0.3);
  }
  100% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #22c55e40, 0 12px 32px rgba(0,0,0,0.2);
  }
}

@keyframes epic-celebration {
  0% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #f97316, 0 12px 32px rgba(0,0,0,0.2);
  }
  25% {
    transform: scale(1.15) translateY(-8px) rotate(2deg);
    box-shadow: 0 0 0 3px white, 0 0 0 10px #f97316, 0 18px 40px rgba(249,115,22,0.4);
  }
  75% {
    transform: scale(1.15) translateY(-8px) rotate(-2deg);
    box-shadow: 0 0 0 3px white, 0 0 0 10px #f97316, 0 18px 40px rgba(249,115,22,0.4);
  }
  100% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #f97316, 0 12px 32px rgba(0,0,0,0.2);
  }
}

@keyframes legendary-celebration {
  0% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #a855f7, 0 12px 32px rgba(0,0,0,0.2);
  }
  20% {
    transform: scale(1.2) translateY(-12px) rotate(5deg);
    box-shadow: 0 0 0 4px gold, 0 0 0 12px #a855f7, 0 25px 50px rgba(168,85,247,0.5);
  }
  40% {
    transform: scale(1.18) translateY(-10px) rotate(-3deg);
    box-shadow: 0 0 0 3px gold, 0 0 0 10px #a855f7, 0 20px 45px rgba(168,85,247,0.4);
  }
  60% {
    transform: scale(1.22) translateY(-14px) rotate(3deg);
    box-shadow: 0 0 0 4px gold, 0 0 0 12px #a855f7, 0 25px 50px rgba(168,85,247,0.5);
  }
  80% {
    transform: scale(1.15) translateY(-8px) rotate(-1deg);
    box-shadow: 0 0 0 3px gold, 0 0 0 8px #a855f7, 0 18px 40px rgba(168,85,247,0.3);
  }
  100% {
    transform: scale(1.08) translateY(-4px);
    box-shadow: 0 0 0 2px white, 0 0 0 6px #a855f7, 0 12px 32px rgba(0,0,0,0.2);
  }
}
`

// Component to inject animations
const AnimationProvider = ({ children }: { children: React.ReactNode }) => {
  useEffect(() => {
    if (typeof document !== 'undefined' && !document.getElementById('celebration-animations')) {
      const style = document.createElement('style')
      style.id = 'celebration-animations'
      style.textContent = celebrationAnimations
      document.head.appendChild(style)
    }
  }, [])

  return <>{children}</>
}

const meta: Meta = {
  title: 'Games/Matching/PlayerStatusBar',
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
The PlayerStatusBar component displays the current state of players in the matching game.
It shows different layouts for single player vs multiplayer modes and includes escalating
celebration effects for consecutive matching pairs.

## Features
- Single player mode with epic styling
- Multiplayer mode with competitive grid layout
- Escalating celebration animations based on consecutive matches:
  - 2+ matches: Great celebration (green)
  - 3+ matches: Epic celebration (orange)
  - 5+ matches: Legendary celebration (purple with gold accents)
- Real-time turn indicators
- Score tracking and progress display
- Responsive design for mobile and desktop

## Animation Preview
The animations demonstrate different celebration levels that activate when players get consecutive matches.
        `,
      },
    },
  },
  decorators: [
    (Story) => (
      <AnimationProvider>
        <div
          className={css({
            width: '800px',
            maxWidth: '90vw',
            padding: '20px',
            background: 'linear-gradient(135deg, #f8fafc, #e2e8f0)',
            minHeight: '400px',
          })}
        >
          <Story />
        </div>
      </AnimationProvider>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof meta>

// Create a mock player card component that showcases the animations
const MockPlayerCard = ({
  emoji,
  name,
  score,
  consecutiveMatches,
  isCurrentPlayer = true,
  celebrationLevel,
}: {
  emoji: string
  name: string
  score: number
  consecutiveMatches: number
  isCurrentPlayer?: boolean
  celebrationLevel: 'normal' | 'great' | 'epic' | 'legendary'
}) => {
  const playerColor =
    celebrationLevel === 'legendary'
      ? '#a855f7'
      : celebrationLevel === 'epic'
        ? '#f97316'
        : celebrationLevel === 'great'
          ? '#22c55e'
          : '#3b82f6'

  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: { base: '3', md: '4' },
        p: isCurrentPlayer ? { base: '4', md: '6' } : { base: '2', md: '3' },
        rounded: isCurrentPlayer ? '2xl' : 'lg',
        background: isCurrentPlayer
          ? `linear-gradient(135deg, ${playerColor}15, ${playerColor}25, ${playerColor}15)`
          : 'white',
        border: isCurrentPlayer ? '4px solid' : '2px solid',
        borderColor: isCurrentPlayer ? playerColor : 'gray.200',
        boxShadow: isCurrentPlayer
          ? `0 0 0 2px white, 0 0 0 6px ${playerColor}40, 0 12px 32px rgba(0,0,0,0.2)`
          : '0 2px 4px rgba(0,0,0,0.1)',
        transition: 'all 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        position: 'relative',
        transform: isCurrentPlayer ? 'scale(1.08) translateY(-4px)' : 'scale(1)',
        zIndex: isCurrentPlayer ? 10 : 1,
        animation: isCurrentPlayer
          ? celebrationLevel === 'legendary'
            ? 'legendary-celebration 0.8s ease-out, turn-entrance 0.6s ease-out'
            : celebrationLevel === 'epic'
              ? 'epic-celebration 0.7s ease-out, turn-entrance 0.6s ease-out'
              : celebrationLevel === 'great'
                ? 'great-celebration 0.6s ease-out, turn-entrance 0.6s ease-out'
                : 'turn-entrance 0.6s ease-out'
          : 'none',
      })}
    >
      {/* Player emoji */}
      <div
        className={css({
          fontSize: isCurrentPlayer ? { base: '3xl', md: '5xl' } : { base: 'lg', md: 'xl' },
          flexShrink: 0,
          animation: isCurrentPlayer
            ? 'float 3s ease-in-out infinite'
            : 'breathe 5s ease-in-out infinite',
          transform: isCurrentPlayer ? 'scale(1.2)' : 'scale(1)',
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          textShadow: isCurrentPlayer ? '0 0 20px currentColor' : 'none',
        })}
      >
        {emoji}
      </div>

      {/* Player info */}
      <div
        className={css({
          flex: 1,
          minWidth: 0,
        })}
      >
        <div
          className={css({
            fontSize: isCurrentPlayer ? { base: 'md', md: 'lg' } : { base: 'xs', md: 'sm' },
            fontWeight: 'black',
            color: isCurrentPlayer ? 'gray.900' : 'gray.700',
            textShadow: isCurrentPlayer ? '0 0 10px currentColor' : 'none',
          })}
        >
          {name}
        </div>

        <div
          className={css({
            fontSize: isCurrentPlayer ? { base: 'sm', md: 'md' } : { base: '2xs', md: 'xs' },
            color: isCurrentPlayer ? playerColor : 'gray.500',
            fontWeight: isCurrentPlayer ? 'black' : 'semibold',
          })}
        >
          {gamePlurals.pair(score)}
          {isCurrentPlayer && (
            <span
              className={css({
                color: 'red.600',
                fontWeight: 'black',
                fontSize: isCurrentPlayer ? { base: 'sm', md: 'lg' } : 'inherit',
                textShadow: '0 0 15px currentColor',
              })}
            >
              {' • Your turn'}
            </span>
          )}
          {consecutiveMatches > 1 && (
            <div
              className={css({
                fontSize: { base: '2xs', md: 'xs' },
                color:
                  celebrationLevel === 'legendary'
                    ? 'purple.600'
                    : celebrationLevel === 'epic'
                      ? 'orange.600'
                      : celebrationLevel === 'great'
                        ? 'green.600'
                        : 'gray.500',
                fontWeight: 'black',
                animation: isCurrentPlayer ? 'streak-pulse 1s ease-in-out infinite' : 'none',
                textShadow: isCurrentPlayer ? '0 0 10px currentColor' : 'none',
              })}
            >
              🔥 {consecutiveMatches} streak!
            </div>
          )}
        </div>
      </div>

      {/* Epic score display */}
      {isCurrentPlayer && (
        <div
          className={css({
            background: 'linear-gradient(135deg, #ff6b6b, #ee5a24)',
            color: 'white',
            px: { base: '3', md: '4' },
            py: { base: '2', md: '3' },
            rounded: 'xl',
            fontSize: { base: 'lg', md: 'xl' },
            fontWeight: 'black',
            boxShadow: '0 4px 15px rgba(238, 90, 36, 0.4)',
            animation: 'gentle-bounce 1.5s ease-in-out infinite',
            textShadow: '0 0 10px rgba(255,255,255,0.8)',
          })}
        >
          ⚡{score}⚡
        </div>
      )}
    </div>
  )
}

// Normal celebration level
export const NormalPlayer: Story = {
  render: () => (
    <MockPlayerCard
      emoji="🚀"
      name="Solo Champion"
      score={3}
      consecutiveMatches={0}
      celebrationLevel="normal"
    />
  ),
}

// Great celebration level
export const GreatStreak: Story = {
  render: () => (
    <MockPlayerCard
      emoji="🎯"
      name="Streak Master"
      score={5}
      consecutiveMatches={2}
      celebrationLevel="great"
    />
  ),
}

// Epic celebration level
export const EpicStreak: Story = {
  render: () => (
    <MockPlayerCard
      emoji="🔥"
      name="Epic Matcher"
      score={7}
      consecutiveMatches={4}
      celebrationLevel="epic"
    />
  ),
}

// Legendary celebration level
export const LegendaryStreak: Story = {
  render: () => (
    <MockPlayerCard
      emoji="👑"
      name="Legend"
      score={8}
      consecutiveMatches={6}
      celebrationLevel="legendary"
    />
  ),
}

// All levels showcase
export const AllCelebrationLevels: Story = {
  render: () => (
    <div className={css({ display: 'flex', flexDirection: 'column', gap: '20px' })}>
      <h3
        className={css({
          textAlign: 'center',
          fontSize: '24px',
          fontWeight: 'bold',
          marginBottom: '20px',
        })}
      >
        Consecutive Match Celebration Levels
      </h3>

      <div
        className={css({
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
          gap: '20px',
        })}
      >
        {/* Normal */}
        <div>
          <h4
            className={css({
              textAlign: 'center',
              marginBottom: '10px',
              fontSize: '16px',
              fontWeight: 'bold',
            })}
          >
            Normal (0-1 matches)
          </h4>
          <MockPlayerCard
            emoji="🚀"
            name="Solo Champion"
            score={3}
            consecutiveMatches={0}
            celebrationLevel="normal"
          />
        </div>

        {/* Great */}
        <div>
          <h4
            className={css({
              textAlign: 'center',
              marginBottom: '10px',
              color: 'green.600',
              fontSize: '16px',
              fontWeight: 'bold',
            })}
          >
            Great (2+ matches)
          </h4>
          <MockPlayerCard
            emoji="🎯"
            name="Streak Master"
            score={5}
            consecutiveMatches={2}
            celebrationLevel="great"
          />
        </div>

        {/* Epic */}
        <div>
          <h4
            className={css({
              textAlign: 'center',
              marginBottom: '10px',
              color: 'orange.600',
              fontSize: '16px',
              fontWeight: 'bold',
            })}
          >
            Epic (3+ matches)
          </h4>
          <MockPlayerCard
            emoji="🔥"
            name="Epic Matcher"
            score={7}
            consecutiveMatches={4}
            celebrationLevel="epic"
          />
        </div>

        {/* Legendary */}
        <div>
          <h4
            className={css({
              textAlign: 'center',
              marginBottom: '10px',
              color: 'purple.600',
              fontSize: '16px',
              fontWeight: 'bold',
            })}
          >
            Legendary (5+ matches)
          </h4>
          <MockPlayerCard
            emoji="👑"
            name="Legend"
            score={8}
            consecutiveMatches={6}
            celebrationLevel="legendary"
          />
        </div>
      </div>

      <div
        className={css({
          textAlign: 'center',
          marginTop: '20px',
          padding: '16px',
          background: 'rgba(255,255,255,0.8)',
          borderRadius: '12px',
          border: '1px solid rgba(0,0,0,0.1)',
        })}
      >
        <p className={css({ fontSize: '14px', color: 'gray.700', margin: 0 })}>
          These animations trigger when a player gets consecutive matching pairs in the memory
          matching game. The celebrations get more intense as the streak grows, providing visual
          feedback and excitement!
        </p>
      </div>
    </div>
  ),
  parameters: {
    layout: 'fullscreen',
  },
}
