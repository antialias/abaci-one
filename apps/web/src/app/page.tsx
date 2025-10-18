'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'
import { AbacusReact } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'
import { container, grid, hstack, stack } from '../../styled-system/patterns'

export default function HomePage() {
  const [abacusValue, setAbacusValue] = useState(1234567)
  return (
    <PageWithNav navTitle="Soroban Mastery Platform" navEmoji="🧮">
      <div className={css({ bg: 'gray.900', minHeight: '100vh' })}>
        {/* Hero with Large Abacus */}
        <div
          className={css({
            background:
              'linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(88, 28, 135, 0.3) 50%, rgba(17, 24, 39, 1) 100%)',
            color: 'white',
            py: { base: '12', md: '20' },
            position: 'relative',
            overflow: 'hidden',
          })}
        >
          <div
            className={css({
              position: 'absolute',
              inset: 0,
              opacity: 0.1,
              backgroundImage:
                'radial-gradient(circle at 2px 2px, rgba(255, 255, 255, 0.15) 1px, transparent 0)',
              backgroundSize: '40px 40px',
            })}
          />
          <div className={container({ maxW: '6xl', px: '4', position: 'relative' })}>
            <div className={css({ textAlign: 'center', maxW: '5xl', mx: 'auto' })}>
              <h1
                className={css({
                  fontSize: { base: '3xl', md: '5xl', lg: '6xl' },
                  fontWeight: 'bold',
                  mb: '6',
                  lineHeight: 'tight',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                })}
              >
                Master the Soroban
              </h1>

              {/* Large Featured Abacus */}
              <div
                className={css({
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4',
                  my: '10',
                  p: '8',
                  bg: 'rgba(0, 0, 0, 0.4)',
                  borderRadius: '2xl',
                  border: '2px solid',
                  borderColor: 'purple.500/30',
                  boxShadow: '0 25px 50px -12px rgba(139, 92, 246, 0.25)',
                })}
              >
                <div
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'semibold',
                    color: 'gray.300',
                    mb: '2',
                  })}
                >
                  Click the beads to interact!
                </div>
                <AbacusReact
                  value={abacusValue}
                  columns={7}
                  beadShape="diamond"
                  colorScheme="place-value"
                  hideInactiveBeads={false}
                  interactive={true}
                  animated={true}
                  soundEnabled={true}
                  soundVolume={0.4}
                  scaleFactor={2.2}
                  showNumbers={true}
                  customStyles={{
                    numerals: {
                      fill: '#fbbf24',
                      fontWeight: 'bold',
                      fontSize: '18px',
                    },
                    reckoningBar: {
                      stroke: '#fbbf24',
                      strokeWidth: 4,
                    },
                    columnPosts: {
                      stroke: '#a78bfa',
                      strokeWidth: 3,
                    },
                  }}
                  onValueChange={(newValue: number) => setAbacusValue(newValue)}
                />
                <div
                  className={css({
                    fontSize: '4xl',
                    fontWeight: 'bold',
                    color: 'yellow.400',
                    fontFamily: 'mono',
                    letterSpacing: 'wide',
                  })}
                >
                  {abacusValue.toLocaleString()}
                </div>
              </div>

              <p
                className={css({
                  fontSize: { base: 'lg', md: 'xl' },
                  color: 'gray.300',
                  mb: '8',
                  maxW: '3xl',
                  mx: 'auto',
                })}
              >
                Interactive tutorials, multiplayer games, and beautiful flashcards—your complete
                soroban learning ecosystem
              </p>

              <div className={hstack({ gap: '4', justify: 'center', flexWrap: 'wrap' })}>
                <Link
                  href="/games"
                  className={css({
                    px: '8',
                    py: '4',
                    bg: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                    color: 'gray.900',
                    fontWeight: 'bold',
                    fontSize: 'lg',
                    rounded: 'xl',
                    shadow: '0 10px 40px rgba(251, 191, 36, 0.3)',
                    _hover: {
                      transform: 'translateY(-2px)',
                      shadow: '0 20px 50px rgba(251, 191, 36, 0.4)',
                    },
                    transition: 'all 0.3s ease',
                  })}
                >
                  🎮 Play Games
                </Link>
                <Link
                  href="/guide"
                  className={css({
                    px: '8',
                    py: '4',
                    bg: 'rgba(139, 92, 246, 0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 'lg',
                    rounded: 'xl',
                    border: '2px solid',
                    borderColor: 'purple.500',
                    _hover: {
                      bg: 'rgba(139, 92, 246, 0.3)',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  })}
                >
                  📚 Learn
                </Link>
                <Link
                  href="/create"
                  className={css({
                    px: '8',
                    py: '4',
                    bg: 'rgba(139, 92, 246, 0.2)',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: 'lg',
                    rounded: 'xl',
                    border: '2px solid',
                    borderColor: 'purple.500',
                    _hover: {
                      bg: 'rgba(139, 92, 246, 0.3)',
                      transform: 'translateY(-2px)',
                    },
                    transition: 'all 0.3s ease',
                  })}
                >
                  🎨 Create
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Color Scheme Showcase */}
        <div className={container({ maxW: '7xl', px: '4', py: '12' })}>
          <section className={stack({ gap: '8' })}>
            <div className={css({ textAlign: 'center' })}>
              <h2
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: 'bold',
                  color: 'white',
                  mb: '3',
                })}
              >
                Beautiful Color Schemes
              </h2>
              <p className={css({ color: 'gray.400', fontSize: 'lg' })}>
                Choose from multiple visual styles to enhance learning
              </p>
            </div>

            <div className={grid({ columns: { base: 1, sm: 2, lg: 4 }, gap: '6' })}>
              <ColorSchemeCard
                title="Monochrome"
                description="Classic, minimalist design"
                colorScheme="monochrome"
                value={42}
                beadShape="diamond"
              />
              <ColorSchemeCard
                title="Place Value"
                description="Each column has its own color"
                colorScheme="place-value"
                value={789}
                beadShape="circle"
              />
              <ColorSchemeCard
                title="Heaven & Earth"
                description="Distinct heaven and earth beads"
                colorScheme="heaven-earth"
                value={156}
                beadShape="square"
              />
              <ColorSchemeCard
                title="Alternating"
                description="Alternating column colors"
                colorScheme="alternating"
                value={234}
                beadShape="diamond"
              />
            </div>
          </section>

          {/* Arcade Games Section */}
          <section className={stack({ gap: '6', mt: '16' })}>
            <div className={hstack({ justify: 'space-between', alignItems: 'center' })}>
              <div>
                <h2
                  className={css({
                    fontSize: { base: '2xl', md: '3xl' },
                    fontWeight: 'bold',
                    color: 'white',
                    mb: '2',
                  })}
                >
                  🕹️ Multiplayer Arcade
                </h2>
                <p className={css({ color: 'gray.400', fontSize: 'md' })}>
                  Compete with friends in real-time soroban games
                </p>
              </div>
              <Link
                href="/games"
                className={css({
                  fontSize: 'md',
                  color: 'yellow.400',
                  fontWeight: 'semibold',
                  _hover: { color: 'yellow.300' },
                  display: { base: 'none', md: 'block' },
                })}
              >
                View All →
              </Link>
            </div>
            <div className={grid({ columns: { base: 1, sm: 2, lg: 4 }, gap: '5' })}>
              <GameCard
                icon="🧠"
                title="Memory Lightning"
                description="Memorize soroban numbers"
                players="1-8 players"
                tags={['Co-op', 'Competitive']}
                gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                href="/games"
              />
              <GameCard
                icon="⚔️"
                title="Matching Pairs"
                description="Turn-based card battles"
                players="1-4 players"
                tags={['Pattern Recognition']}
                gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                href="/games"
              />
              <GameCard
                icon="🏁"
                title="Speed Race"
                description="Race AI with complements"
                players="1-4 players + AI"
                tags={['Practice', 'Sprint', 'Survival']}
                gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
                href="/games"
              />
              <GameCard
                icon="🔢"
                title="Card Sorting"
                description="Arrange cards visually"
                players="Solo challenge"
                tags={['Visual Literacy']}
                gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
                href="/games"
              />
            </div>
          </section>

          {/* Interactive Learning & Flashcard Creator */}
          <div className={grid({ columns: { base: 1, lg: 2 }, gap: '8', mt: '16' })}>
            <FeaturePanel
              icon="📚"
              title="Interactive Learning"
              description="Master soroban through hands-on guided tutorials"
              features={[
                'Visual tutorials on reading bead positions',
                'Step-by-step arithmetic operations',
                'Interactive exercises with instant feedback',
              ]}
              ctaText="Start Learning →"
              ctaHref="/guide"
              accentColor="purple"
            />
            <FeaturePanel
              icon="🎨"
              title="Flashcard Creator"
              description="Design beautiful soroban flashcards for any purpose"
              features={[
                'Multiple export formats: PDF, PNG, SVG, HTML',
                'Custom bead shapes, colors, and layouts',
                'All paper sizes: A3, A4, A5, US Letter',
              ]}
              ctaText="Create Flashcards →"
              ctaHref="/create"
              accentColor="blue"
            />
          </div>

          {/* Stats Banner */}
          <section
            className={css({
              bg: 'linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%)',
              rounded: '2xl',
              p: '10',
              mt: '16',
              border: '2px solid',
              borderColor: 'purple.500/20',
            })}
          >
            <h2
              className={css({
                fontSize: { base: 'xl', md: '2xl' },
                fontWeight: 'bold',
                mb: '8',
                textAlign: 'center',
                color: 'white',
              })}
            >
              Complete Soroban Learning Platform
            </h2>
            <div className={grid({ columns: { base: 2, md: 4 }, gap: '8', textAlign: 'center' })}>
              <StatItem number="4" label="Arcade Games" />
              <StatItem number="8" label="Max Players" />
              <StatItem number="3" label="Learning Modes" />
              <StatItem number="4+" label="Export Formats" />
            </div>
          </section>
        </div>
      </div>
    </PageWithNav>
  )
}

function ColorSchemeCard({
  title,
  description,
  colorScheme,
  value,
  beadShape,
}: {
  title: string
  description: string
  colorScheme: 'monochrome' | 'place-value' | 'heaven-earth' | 'alternating'
  value: number
  beadShape: 'diamond' | 'circle' | 'square'
}) {
  return (
    <div
      className={css({
        bg: 'rgba(0, 0, 0, 0.4)',
        rounded: 'xl',
        p: '6',
        border: '2px solid',
        borderColor: 'gray.700',
        transition: 'all 0.3s ease',
        _hover: {
          borderColor: 'purple.500',
          transform: 'translateY(-4px)',
          boxShadow: '0 20px 40px rgba(139, 92, 246, 0.2)',
        },
      })}
    >
      <h3
        className={css({
          fontSize: 'lg',
          fontWeight: 'bold',
          color: 'white',
          mb: '2',
        })}
      >
        {title}
      </h3>
      <p className={css({ fontSize: 'sm', color: 'gray.400', mb: '4' })}>{description}</p>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'center',
          p: '4',
          bg: 'rgba(255, 255, 255, 0.05)',
          rounded: 'lg',
        })}
      >
        <AbacusReact
          value={value}
          columns={3}
          beadShape={beadShape}
          colorScheme={colorScheme}
          hideInactiveBeads={false}
        />
      </div>
    </div>
  )
}

function GameCard({
  icon,
  title,
  description,
  players,
  tags,
  gradient,
  href,
}: {
  icon: string
  title: string
  description: string
  players: string
  tags: string[]
  gradient: string
  href: string
}) {
  return (
    <Link href={href}>
      <div
        className={css({
          background: gradient,
          rounded: 'xl',
          p: '6',
          shadow: 'lg',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          _hover: {
            transform: 'translateY(-6px) scale(1.02)',
            shadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
          },
        })}
      >
        <div className={css({ fontSize: '3xl', mb: '3' })}>{icon}</div>
        <h3 className={css({ fontSize: 'lg', fontWeight: 'bold', color: 'white', mb: '2' })}>
          {title}
        </h3>
        <p className={css({ fontSize: 'sm', color: 'rgba(255, 255, 255, 0.9)', mb: '2' })}>
          {description}
        </p>
        <p className={css({ fontSize: 'xs', color: 'rgba(255, 255, 255, 0.7)', mb: '3' })}>
          {players}
        </p>
        <div className={hstack({ gap: '2', flexWrap: 'wrap' })}>
          {tags.map((tag) => (
            <span
              key={tag}
              className={css({
                fontSize: 'xs',
                px: '2',
                py: '1',
                bg: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                rounded: 'full',
                fontWeight: 'semibold',
              })}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </Link>
  )
}

function FeaturePanel({
  icon,
  title,
  description,
  features,
  ctaText,
  ctaHref,
  accentColor,
}: {
  icon: string
  title: string
  description: string
  features: string[]
  ctaText: string
  ctaHref: string
  accentColor: 'purple' | 'blue'
}) {
  const borderColor = accentColor === 'purple' ? 'purple.500/30' : 'blue.500/30'
  const bgColor = accentColor === 'purple' ? 'purple.500/10' : 'blue.500/10'
  const hoverBg = accentColor === 'purple' ? 'purple.500/20' : 'blue.500/20'

  return (
    <div
      className={css({
        bg: 'rgba(0, 0, 0, 0.4)',
        rounded: 'xl',
        p: '8',
        border: '2px solid',
        borderColor,
      })}
    >
      <div className={hstack({ gap: '3', mb: '4' })}>
        <span className={css({ fontSize: '3xl' })}>{icon}</span>
        <h2 className={css({ fontSize: '2xl', fontWeight: 'bold', color: 'white' })}>{title}</h2>
      </div>
      <p className={css({ fontSize: 'md', color: 'gray.300', mb: '6' })}>{description}</p>
      <div className={stack({ gap: '3', mb: '6' })}>
        {features.map((feature, i) => (
          <div key={i} className={hstack({ gap: '3' })}>
            <span className={css({ color: 'yellow.400', fontSize: 'lg' })}>✓</span>
            <span className={css({ color: 'gray.300', fontSize: 'sm' })}>{feature}</span>
          </div>
        ))}
      </div>
      <Link
        href={ctaHref}
        className={css({
          display: 'block',
          textAlign: 'center',
          py: '3',
          px: '6',
          bg: bgColor,
          color: 'white',
          fontWeight: 'bold',
          rounded: 'lg',
          border: '2px solid',
          borderColor,
          _hover: { bg: hoverBg },
          transition: 'all 0.2s ease',
        })}
      >
        {ctaText}
      </Link>
    </div>
  )
}

function StatItem({ number, label }: { number: string; label: string }) {
  return (
    <div>
      <div
        className={css({
          fontSize: { base: '3xl', md: '4xl' },
          fontWeight: 'bold',
          mb: '2',
          background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
          backgroundClip: 'text',
          color: 'transparent',
        })}
      >
        {number}
      </div>
      <div className={css({ fontSize: 'sm', color: 'gray.300' })}>{label}</div>
    </div>
  )
}
