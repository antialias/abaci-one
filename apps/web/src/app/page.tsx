'use client'

import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../styled-system/css'
import { container, grid, hstack, stack } from '../../styled-system/patterns'

export default function HomePage() {
  return (
    <PageWithNav navTitle="Soroban Mastery Platform" navEmoji="🧮">
      <div className={css({ bg: 'gray.50', minHeight: '100vh' })}>
        {/* Compact Hero */}
        <div
          className={css({
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            py: { base: '8', md: '12' },
          })}
        >
          <div className={container({ maxW: '6xl', px: '4' })}>
            <div className={css({ textAlign: 'center', maxW: '4xl', mx: 'auto' })}>
              <h1
                className={css({
                  fontSize: { base: '3xl', md: '5xl' },
                  fontWeight: 'bold',
                  mb: '4',
                  lineHeight: 'tight',
                })}
              >
                Master Soroban Through{' '}
                <span className={css({ color: 'yellow.300' })}>Play & Practice</span>
              </h1>
              <p className={css({ fontSize: { base: 'md', md: 'lg' }, opacity: 0.95, mb: '6' })}>
                Interactive tutorials, multiplayer games, and beautiful flashcards—your complete
                soroban learning ecosystem
              </p>
              <div className={hstack({ gap: '3', justify: 'center', flexWrap: 'wrap' })}>
                <Link
                  href="/arcade"
                  className={css({
                    px: '6',
                    py: '3',
                    bg: 'yellow.400',
                    color: 'gray.900',
                    fontWeight: 'bold',
                    rounded: 'lg',
                    shadow: 'lg',
                    _hover: { bg: 'yellow.300', transform: 'translateY(-2px)' },
                    transition: 'all',
                  })}
                >
                  🎮 Play Games
                </Link>
                <Link
                  href="/guide"
                  className={css({
                    px: '6',
                    py: '3',
                    bg: 'white',
                    color: 'purple.700',
                    fontWeight: 'bold',
                    rounded: 'lg',
                    shadow: 'lg',
                    _hover: { bg: 'gray.100', transform: 'translateY(-2px)' },
                    transition: 'all',
                  })}
                >
                  📚 Learn
                </Link>
                <Link
                  href="/create"
                  className={css({
                    px: '6',
                    py: '3',
                    bg: 'purple.600',
                    color: 'white',
                    fontWeight: 'bold',
                    rounded: 'lg',
                    shadow: 'lg',
                    _hover: { bg: 'purple.700', transform: 'translateY(-2px)' },
                    transition: 'all',
                  })}
                >
                  🎨 Create
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className={container({ maxW: '7xl', px: '4', py: '8' })}>
          <div className={stack({ gap: '8' })}>
            {/* Arcade Games Section */}
            <section>
              <div className={hstack({ justify: 'space-between', mb: '4' })}>
                <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'gray.900' })}>
                  🕹️ Multiplayer Arcade
                </h2>
                <Link
                  href="/arcade"
                  className={css({
                    fontSize: 'sm',
                    color: 'purple.600',
                    fontWeight: 'semibold',
                    _hover: { color: 'purple.700' },
                  })}
                >
                  View All →
                </Link>
              </div>
              <div className={grid({ columns: { base: 1, sm: 2, lg: 4 }, gap: '4' })}>
                <GameCard
                  icon="🧠"
                  title="Memory Lightning"
                  description="Memorize soroban numbers"
                  players="1-8 players"
                  tags={['Co-op', 'Competitive']}
                />
                <GameCard
                  icon="⚔️"
                  title="Matching Pairs"
                  description="Turn-based card battles"
                  players="1-4 players"
                  tags={['Pattern Recognition']}
                />
                <GameCard
                  icon="🏁"
                  title="Speed Race"
                  description="Race AI with complements"
                  players="1-4 players + AI"
                  tags={['Practice', 'Sprint', 'Survival']}
                />
                <GameCard
                  icon="🔢"
                  title="Card Sorting"
                  description="Arrange cards visually"
                  players="Solo challenge"
                  tags={['Visual Literacy']}
                />
              </div>
            </section>

            {/* Two Column Layout */}
            <div className={grid({ columns: { base: 1, lg: 2 }, gap: '6' })}>
              {/* Interactive Learning */}
              <section
                className={css({
                  bg: 'white',
                  rounded: 'xl',
                  p: '6',
                  shadow: 'sm',
                  border: '1px solid',
                  borderColor: 'gray.200',
                })}
              >
                <h2
                  className={css({
                    fontSize: 'xl',
                    fontWeight: 'bold',
                    color: 'gray.900',
                    mb: '4',
                  })}
                >
                  📚 Interactive Learning
                </h2>
                <div className={stack({ gap: '3' })}>
                  <FeatureItem
                    icon="🔍"
                    title="Reading Numbers"
                    description="Visual tutorials on interpreting bead positions"
                  />
                  <FeatureItem
                    icon="🧮"
                    title="Arithmetic Operations"
                    description="Step-by-step interactive practice: +, −, ×, ÷"
                  />
                  <FeatureItem
                    icon="🎯"
                    title="Guided Tutorials"
                    description="Hands-on exercises with instant feedback"
                  />
                </div>
                <Link
                  href="/guide"
                  className={css({
                    display: 'block',
                    mt: '4',
                    py: '2',
                    textAlign: 'center',
                    bg: 'purple.50',
                    color: 'purple.700',
                    fontWeight: 'semibold',
                    rounded: 'lg',
                    _hover: { bg: 'purple.100' },
                  })}
                >
                  Start Learning →
                </Link>
              </section>

              {/* Flashcard Creator */}
              <section
                className={css({
                  bg: 'white',
                  rounded: 'xl',
                  p: '6',
                  shadow: 'sm',
                  border: '1px solid',
                  borderColor: 'gray.200',
                })}
              >
                <h2
                  className={css({
                    fontSize: 'xl',
                    fontWeight: 'bold',
                    color: 'gray.900',
                    mb: '4',
                  })}
                >
                  🎨 Flashcard Creator
                </h2>
                <div className={stack({ gap: '3' })}>
                  <FeatureItem
                    icon="📄"
                    title="Multiple Formats"
                    description="PDF, PNG, SVG, interactive HTML"
                  />
                  <FeatureItem
                    icon="🎨"
                    title="Custom Styling"
                    description="Bead shapes, color schemes, fonts, layouts"
                  />
                  <FeatureItem
                    icon="📐"
                    title="Paper Options"
                    description="A3, A4, A5, US Letter • Portrait/Landscape"
                  />
                </div>
                <Link
                  href="/create"
                  className={css({
                    display: 'block',
                    mt: '4',
                    py: '2',
                    textAlign: 'center',
                    bg: 'blue.50',
                    color: 'blue.700',
                    fontWeight: 'semibold',
                    rounded: 'lg',
                    _hover: { bg: 'blue.100' },
                  })}
                >
                  Create Flashcards →
                </Link>
              </section>
            </div>

            {/* Multiplayer Features */}
            <section>
              <h2
                className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'gray.900', mb: '4' })}
              >
                🌐 Multiplayer Features
              </h2>
              <div className={grid({ columns: { base: 1, sm: 2, md: 4 }, gap: '4' })}>
                <FeatureCard
                  icon="🎭"
                  title="Player Characters"
                  description="Custom names, emojis, and colors for each player"
                />
                <FeatureCard
                  icon="🏠"
                  title="Private Rooms"
                  description="Create rooms with codes, passwords, or approval-only access"
                />
                <FeatureCard
                  icon="⚡"
                  title="Real-time Play"
                  description="Socket.io powered instant multiplayer sync"
                />
                <FeatureCard
                  icon="📊"
                  title="Stats & Progress"
                  description="Track wins, accuracy, and performance across games"
                />
              </div>
            </section>

            {/* Quick Stats */}
            <section
              className={css({
                bg: 'gradient-to-r',
                gradientFrom: 'purple.600',
                gradientTo: 'indigo.600',
                rounded: 'xl',
                p: '6',
                color: 'white',
              })}
            >
              <h2
                className={css({
                  fontSize: 'xl',
                  fontWeight: 'bold',
                  mb: '4',
                  textAlign: 'center',
                })}
              >
                Complete Soroban Learning Platform
              </h2>
              <div className={grid({ columns: { base: 2, md: 4 }, gap: '6', textAlign: 'center' })}>
                <StatItem number="4" label="Arcade Games" />
                <StatItem number="8" label="Max Players" />
                <StatItem number="3" label="Learning Modes" />
                <StatItem number="4+" label="Export Formats" />
              </div>
            </section>
          </div>
        </div>
      </div>
    </PageWithNav>
  )
}

function GameCard({
  icon,
  title,
  description,
  players,
  tags,
}: {
  icon: string
  title: string
  description: string
  players: string
  tags: string[]
}) {
  return (
    <div
      className={css({
        bg: 'white',
        rounded: 'lg',
        p: '4',
        shadow: 'sm',
        border: '1px solid',
        borderColor: 'gray.200',
        transition: 'all',
        _hover: { shadow: 'md', transform: 'translateY(-2px)' },
      })}
    >
      <div className={css({ fontSize: '2xl', mb: '2' })}>{icon}</div>
      <h3 className={css({ fontSize: 'md', fontWeight: 'bold', color: 'gray.900', mb: '1' })}>
        {title}
      </h3>
      <p className={css({ fontSize: 'sm', color: 'gray.600', mb: '2' })}>{description}</p>
      <p className={css({ fontSize: 'xs', color: 'gray.500', mb: '2' })}>{players}</p>
      <div className={hstack({ gap: '1', flexWrap: 'wrap' })}>
        {tags.map((tag) => (
          <span
            key={tag}
            className={css({
              fontSize: 'xs',
              px: '2',
              py: '0.5',
              bg: 'purple.100',
              color: 'purple.700',
              rounded: 'full',
            })}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  )
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div className={hstack({ gap: '3', alignItems: 'flex-start' })}>
      <div className={css({ fontSize: 'xl', flexShrink: 0 })}>{icon}</div>
      <div>
        <h4 className={css({ fontSize: 'sm', fontWeight: 'semibold', color: 'gray.900' })}>
          {title}
        </h4>
        <p className={css({ fontSize: 'xs', color: 'gray.600' })}>{description}</p>
      </div>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string
  title: string
  description: string
}) {
  return (
    <div
      className={css({
        bg: 'white',
        rounded: 'lg',
        p: '4',
        shadow: 'sm',
        border: '1px solid',
        borderColor: 'gray.200',
        textAlign: 'center',
      })}
    >
      <div className={css({ fontSize: '2xl', mb: '2' })}>{icon}</div>
      <h3 className={css({ fontSize: 'sm', fontWeight: 'bold', color: 'gray.900', mb: '1' })}>
        {title}
      </h3>
      <p className={css({ fontSize: 'xs', color: 'gray.600', lineHeight: 'relaxed' })}>
        {description}
      </p>
    </div>
  )
}

function StatItem({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div className={css({ fontSize: '3xl', fontWeight: 'bold', mb: '1' })}>{number}</div>
      <div className={css({ fontSize: 'sm', opacity: 0.9 })}>{label}</div>
    </div>
  )
}
