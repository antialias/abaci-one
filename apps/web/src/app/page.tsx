'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { HeroAbacus } from '@/components/HeroAbacus'
import { HomeHeroProvider } from '@/contexts/HomeHeroContext'
import { PageWithNav } from '@/components/PageWithNav'
import { TutorialPlayer } from '@/components/tutorial/TutorialPlayer'
import { getTutorialForEditor } from '@/utils/tutorialConverter'
import { css } from '../../styled-system/css'
import { container, grid, hstack, stack } from '../../styled-system/patterns'
import { token } from '../../styled-system/tokens'

// Mini abacus that cycles through random 3-digit numbers
function MiniAbacus() {
  const [currentValue, setCurrentValue] = useState(123)
  const appConfig = useAbacusConfig()

  useEffect(() => {
    // Cycle through random 3-digit numbers every 2.5 seconds
    const interval = setInterval(() => {
      const randomNum = Math.floor(Math.random() * 1000) // 0-999
      setCurrentValue(randomNum)
    }, 2500)

    return () => clearInterval(interval)
  }, [])

  // Dark theme styles for the abacus
  const darkStyles = {
    columnPosts: {
      fill: 'rgba(255, 255, 255, 0.3)',
      stroke: 'rgba(255, 255, 255, 0.2)',
      strokeWidth: 2,
    },
    reckoningBar: {
      fill: 'rgba(255, 255, 255, 0.4)',
      stroke: 'rgba(255, 255, 255, 0.25)',
      strokeWidth: 3,
    },
  }

  return (
    <div
      className={css({
        width: '75px',
        height: '80px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <div className={css({ transform: 'scale(0.6)', transformOrigin: 'center center' })}>
        <AbacusReact
          value={currentValue}
          columns={3}
          beadShape={appConfig.beadShape}
          customStyles={darkStyles}
        />
      </div>
    </div>
  )
}

export default function HomePage() {
  // Extract just the "Friends of 5" step (2+3=5) for homepage demo
  const fullTutorial = getTutorialForEditor()
  const friendsOf5Tutorial = {
    ...fullTutorial,
    id: 'friends-of-5-demo',
    title: 'Friends of 5',
    description: 'Learn the "Friends of 5" technique: adding 3 to make 5',
    steps: fullTutorial.steps.filter((step) => step.id === 'complement-2'),
  }

  return (
    <HomeHeroProvider>
      <PageWithNav>
        <div className={css({ bg: 'gray.900', minHeight: '100vh' })}>
          {/* Hero Section with Large Interactive Abacus */}
          <HeroAbacus />

          {/* Main content container */}
          <div className={container({ maxW: '7xl', px: '4', py: '12' })}>
            {/* Learn by Doing Section - with inline tutorial demo */}
            <section className={stack({ gap: '8', mb: '16' })}>
              <div className={css({ textAlign: 'center' })}>
                <h2
                  className={css({
                    fontSize: { base: '2xl', md: '3xl' },
                    fontWeight: 'bold',
                    color: 'white',
                    mb: '2',
                  })}
                >
                  Learn by Doing
                </h2>
                <p className={css({ color: 'gray.400', fontSize: 'md', maxW: '2xl', mx: 'auto' })}>
                  Interactive tutorials teach you step-by-step. Try this example right now:
                </p>
              </div>

              {/* Live demo and learning objectives */}
              <div
                className={css({
                  bg: 'rgba(0, 0, 0, 0.4)',
                  rounded: 'xl',
                  p: '8',
                  border: '1px solid',
                  borderColor: 'gray.700',
                  shadow: 'lg',
                  maxW: '1200px',
                  mx: 'auto',
                })}
              >
                <div
                  className={css({
                    display: 'flex',
                    flexDirection: { base: 'column', md: 'row' },
                    gap: '8',
                    alignItems: { base: 'center', md: 'flex-start' },
                  })}
                >
                  {/* Tutorial on the left */}
                  <div className={css({ flex: '1' })}>
                    <TutorialPlayer
                      tutorial={friendsOf5Tutorial}
                      isDebugMode={false}
                      showDebugPanel={false}
                      hideNavigation={true}
                      hideTooltip={true}
                      silentErrors={true}
                      abacusColumns={1}
                      theme="dark"
                    />
                  </div>

                  {/* What you'll learn on the right */}
                  <div
                    className={css({
                      flex: '0 0 auto',
                      minW: '340px',
                      maxW: { base: '100%', md: '420px' },
                    })}
                  >
                    <h3
                      className={css({
                        fontSize: '2xl',
                        fontWeight: 'bold',
                        color: 'white',
                        mb: '6',
                      })}
                    >
                      What You'll Learn
                    </h3>
                    <div className={stack({ gap: '5' })}>
                      {[
                        {
                          icon: '🔢',
                          title: 'Read and set numbers',
                          desc: 'Master abacus number representation from zero to thousands',
                          example: '0-9999',
                          badge: 'Foundation',
                        },
                        {
                          icon: '🤝',
                          title: 'Friends techniques',
                          desc: 'Add and subtract using complement pairs and mental shortcuts',
                          example: '5 = 2+3',
                          badge: 'Core',
                        },
                        {
                          icon: '✖️➗',
                          title: 'Multiply & divide',
                          desc: 'Fluent multi-digit calculations with advanced techniques',
                          example: '12×34',
                          badge: 'Advanced',
                        },
                        {
                          icon: '🧠',
                          title: 'Mental calculation',
                          desc: 'Visualize and compute without the physical tool (Anzan)',
                          example: 'Speed math',
                          badge: 'Expert',
                        },
                      ].map((skill, i) => (
                        <div
                          key={i}
                          className={css({
                            bg: 'linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03))',
                            borderRadius: 'xl',
                            p: '4',
                            border: '1px solid',
                            borderColor: 'rgba(255, 255, 255, 0.15)',
                            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                            transition: 'all 0.2s',
                            _hover: {
                              bg: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                              borderColor: 'rgba(255, 255, 255, 0.25)',
                              transform: 'translateY(-2px)',
                              boxShadow: '0 6px 16px rgba(0, 0, 0, 0.4)',
                            },
                          })}
                        >
                          <div className={hstack({ gap: '3', alignItems: 'flex-start' })}>
                            <div
                              className={css({
                                fontSize: '3xl',
                                width: '75px',
                                height: '115px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                bg: 'rgba(255, 255, 255, 0.1)',
                                borderRadius: 'lg',
                              })}
                            >
                              {i === 0 ? <MiniAbacus /> : skill.icon}
                            </div>
                            <div className={stack({ gap: '2', flex: '1' })}>
                              <div className={hstack({ gap: '2', alignItems: 'center' })}>
                                <div
                                  className={css({
                                    color: 'white',
                                    fontSize: 'md',
                                    fontWeight: 'bold',
                                  })}
                                >
                                  {skill.title}
                                </div>
                                <div
                                  className={css({
                                    bg: 'rgba(250, 204, 21, 0.2)',
                                    color: 'yellow.400',
                                    fontSize: '2xs',
                                    fontWeight: 'semibold',
                                    px: '2',
                                    py: '0.5',
                                    borderRadius: 'md',
                                  })}
                                >
                                  {skill.badge}
                                </div>
                              </div>
                              <div
                                className={css({
                                  color: 'gray.300',
                                  fontSize: 'xs',
                                  lineHeight: '1.5',
                                })}
                              >
                                {skill.desc}
                              </div>
                              <div
                                className={css({
                                  color: 'yellow.400',
                                  fontSize: 'xs',
                                  fontFamily: 'mono',
                                  fontWeight: 'semibold',
                                  mt: '1',
                                  bg: 'rgba(250, 204, 21, 0.1)',
                                  px: '2',
                                  py: '1',
                                  borderRadius: 'md',
                                  w: 'fit-content',
                                })}
                              >
                                {skill.example}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Current Offerings Section */}
            <section className={stack({ gap: '6', mb: '16' })}>
              <div className={css({ textAlign: 'center' })}>
                <h2
                  className={css({
                    fontSize: { base: '2xl', md: '3xl' },
                    fontWeight: 'bold',
                    color: 'white',
                    mb: '2',
                  })}
                >
                  Available Now
                </h2>
                <p className={css({ color: 'gray.400', fontSize: 'md' })}>
                  Foundation tutorials and reinforcement games ready to use
                </p>
              </div>

              <div className={grid({ columns: { base: 1, sm: 2, lg: 4 }, gap: '5' })}>
                <GameCard
                  icon="🧠"
                  title="Memory Lightning"
                  description="Memorize soroban numbers"
                  players="1-8 players"
                  tags={['Memory', 'Pattern Recognition']}
                  gradient="linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                  href="/games"
                />
                <GameCard
                  icon="⚔️"
                  title="Matching Pairs"
                  description="Match complement numbers"
                  players="1-4 players"
                  tags={['Friends of 5', 'Friends of 10']}
                  gradient="linear-gradient(135deg, #f093fb 0%, #f5576c 100%)"
                  href="/games"
                />
                <GameCard
                  icon="🏁"
                  title="Complement Race"
                  description="Race against time"
                  players="1-4 players"
                  tags={['Speed', 'Practice', 'Survival']}
                  gradient="linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)"
                  href="/games"
                />
                <GameCard
                  icon="🔢"
                  title="Card Sorting"
                  description="Arrange numbers visually"
                  players="Solo challenge"
                  tags={['Visual Literacy', 'Ordering']}
                  gradient="linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)"
                  href="/games"
                />
              </div>
            </section>

            {/* For Kids & Families Section */}
            <section className={stack({ gap: '6', mb: '16' })}>
              <div className={css({ textAlign: 'center' })}>
                <h2
                  className={css({
                    fontSize: { base: '2xl', md: '3xl' },
                    fontWeight: 'bold',
                    color: 'white',
                    mb: '2',
                  })}
                >
                  For Kids & Families
                </h2>
                <p className={css({ color: 'gray.400', fontSize: 'md', maxW: '2xl', mx: 'auto' })}>
                  Simple enough for kids to start on their own, structured enough for parents to
                  trust
                </p>
              </div>

              <div className={grid({ columns: { base: 1, lg: 2 }, gap: '8' })}>
                <FeaturePanel
                  icon="🧒"
                  title="Self-Directed for Children"
                  features={[
                    'Big, obvious buttons and clear instructions',
                    'Progress at your own pace',
                    'Works with or without a physical abacus',
                  ]}
                  accentColor="purple"
                />
                <FeaturePanel
                  icon="👨‍👩‍👧"
                  title="Trusted by Parents"
                  features={[
                    'Structured curriculum following Japanese methods',
                    'Traditional kyu/dan progression levels',
                    'Track progress and celebrate achievements',
                  ]}
                  accentColor="blue"
                />
              </div>
            </section>

            {/* Progression Visualization */}
            <section className={stack({ gap: '6', mb: '16' })}>
              <div className={css({ textAlign: 'center' })}>
                <h2
                  className={css({
                    fontSize: { base: '2xl', md: '3xl' },
                    fontWeight: 'bold',
                    color: 'white',
                    mb: '2',
                  })}
                >
                  Your Journey
                </h2>
                <p style={{ color: '#e5e7eb', fontSize: '16px' }}>
                  Progress from beginner to master
                </p>
              </div>

              <Link
                href="/levels"
                className={css({
                  bg: 'rgba(0, 0, 0, 0.4)',
                  border: '1px solid',
                  borderColor: 'gray.700',
                  rounded: 'xl',
                  p: '8',
                  display: 'block',
                  transition: 'all 0.2s',
                  cursor: 'pointer',
                  position: 'relative',
                  _hover: {
                    bg: 'rgba(0, 0, 0, 0.5)',
                    borderColor: 'violet.500',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 16px rgba(124, 58, 237, 0.2)',
                  },
                })}
              >
                {/* Subtle arrow indicator */}
                <div
                  className={css({
                    position: 'absolute',
                    top: '4',
                    right: '4',
                    fontSize: 'xl',
                    color: 'gray.500',
                    transition: 'all 0.2s',
                    _groupHover: {
                      color: 'violet.400',
                      transform: 'translateX(4px)',
                    },
                  })}
                >
                  →
                </div>

                <div
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '4',
                    flexWrap: 'wrap',
                  })}
                >
                  {(
                    [
                      {
                        level: '10 Kyu',
                        label: 'Beginner',
                        color: 'colors.green.400',
                        emoji: '🧒',
                      },
                      {
                        level: '5 Kyu',
                        label: 'Intermediate',
                        color: 'colors.blue.400',
                        emoji: '🧑',
                      },
                      {
                        level: '1 Kyu',
                        label: 'Advanced',
                        color: 'colors.violet.400',
                        emoji: '🧔',
                      },
                      { level: 'Dan', label: 'Master', color: 'colors.amber.400', emoji: '🧙' },
                    ] as const
                  ).map((stage, i) => (
                    <div
                      key={i}
                      className={stack({
                        gap: '0',
                        textAlign: 'center',
                        flex: '1',
                        position: 'relative',
                      })}
                    >
                      <div
                        className={css({
                          fontSize: '5xl',
                          mb: '0',
                        })}
                      >
                        {stage.emoji}
                      </div>
                      <div
                        className={css({
                          fontSize: 'xl',
                          fontWeight: 'bold',
                          mt: '-2',
                        })}
                        style={{ color: token(stage.color) }}
                      >
                        {stage.level}
                      </div>
                      <div
                        className={css({
                          fontSize: 'sm',
                          color: 'gray.300',
                        })}
                      >
                        {stage.label}
                      </div>
                      {i < 3 && (
                        <div
                          style={{
                            position: 'absolute',
                            left: '100%',
                            marginLeft: '0.5rem',
                            top: '50%',
                            transform: 'translate(-50%, -50%)',
                            fontSize: '20px',
                            color: '#9ca3af',
                          }}
                          className={css({
                            display: { base: 'none', md: 'block' },
                          })}
                        >
                          →
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div
                  style={{
                    textAlign: 'center',
                    fontSize: '14px',
                    color: '#d1d5db',
                    fontStyle: 'italic',
                  }}
                  className={css({
                    mt: '6',
                  })}
                >
                  Click to learn about the official Japanese ranking system →
                </div>
              </Link>
            </section>

            {/* Additional Tools Section */}
            <section className={stack({ gap: '6' })}>
              <div className={css({ textAlign: 'center' })}>
                <h2
                  className={css({
                    fontSize: { base: '2xl', md: '3xl' },
                    fontWeight: 'bold',
                    color: 'white',
                    mb: '2',
                  })}
                >
                  Additional Tools
                </h2>
              </div>

              <div className={grid({ columns: { base: 1, lg: 2 }, gap: '8' })}>
                <FeaturePanel
                  icon="🎨"
                  title="Flashcard Creator"
                  features={[
                    'Multiple formats: PDF, PNG, SVG, HTML',
                    'Custom bead shapes, colors, and layouts',
                    'All paper sizes: A3, A4, A5, US Letter',
                  ]}
                  accentColor="blue"
                  ctaText="Create Flashcards →"
                  ctaHref="/create"
                />
                <FeaturePanel
                  icon="🧮"
                  title="Interactive Abacus"
                  features={[
                    'Practice anytime in your browser',
                    'Multiple color schemes and bead styles',
                    'Sound effects and animations',
                  ]}
                  accentColor="purple"
                  ctaText="Try the Abacus →"
                  ctaHref="/guide"
                />
              </div>
            </section>
          </div>
        </div>
      </PageWithNav>
    </HomeHeroProvider>
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
          rounded: 'xl',
          p: '6',
          shadow: 'lg',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          _hover: {
            transform: 'translateY(-6px) scale(1.02)',
            shadow: '0 25px 50px rgba(0, 0, 0, 0.3)',
          },
        })}
      >
        {/* Vibrant gradient background */}
        <div
          style={{ background: gradient }}
          className={css({
            position: 'absolute',
            inset: 0,
            zIndex: 0,
          })}
        />
        {/* Dark gradient overlay for text readability */}
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.5) 100%)',
            zIndex: 1,
          })}
        />
        {/* Content */}
        <div className={css({ position: 'relative', zIndex: 2 })}>
          <div
            className={css({
              fontSize: '3xl',
              mb: '3',
              textShadow: '0 2px 4px rgba(0, 0, 0, 0.3)',
            })}
          >
            {icon}
          </div>
          <h3
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              color: 'white',
              mb: '2',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
            })}
          >
            {title}
          </h3>
          <p
            className={css({
              fontSize: 'sm',
              color: 'rgba(255, 255, 255, 0.95)',
              mb: '2',
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
            })}
          >
            {description}
          </p>
          <p
            className={css({
              fontSize: 'xs',
              color: 'rgba(255, 255, 255, 0.85)',
              mb: '3',
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
            })}
          >
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
                  textShadow: '0 1px 3px rgba(0, 0, 0, 0.4)',
                })}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
    </Link>
  )
}

function FeaturePanel({
  icon,
  title,
  features,
  accentColor,
  ctaText,
  ctaHref,
}: {
  icon: string
  title: string
  features: string[]
  accentColor: 'purple' | 'blue'
  ctaText?: string
  ctaHref?: string
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
      <div className={stack({ gap: '3', mb: ctaText ? '6' : '0' })}>
        {features.map((feature, i) => (
          <div key={i} className={hstack({ gap: '3' })}>
            <span className={css({ color: 'yellow.400', fontSize: 'lg' })}>✓</span>
            <span className={css({ color: 'gray.300', fontSize: 'sm' })}>{feature}</span>
          </div>
        ))}
      </div>
      {ctaText && ctaHref && (
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
      )}
    </div>
  )
}
