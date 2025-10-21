'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { HeroAbacus } from '@/components/HeroAbacus'
import { HomeHeroProvider } from '@/contexts/HomeHeroContext'
import { PageWithNav } from '@/components/PageWithNav'
import { TutorialPlayer } from '@/components/tutorial/TutorialPlayer'
import { getTutorialForEditor } from '@/utils/tutorialConverter'
import { getAvailableGames } from '@/lib/arcade/game-registry'
import { InteractiveFlashcards } from '@/components/InteractiveFlashcards'
import { LevelSliderDisplay } from '@/components/LevelSliderDisplay'
import { css } from '../../styled-system/css'
import { container, grid, hstack, stack } from '../../styled-system/patterns'

// Mini abacus that cycles through a sequence of values
function MiniAbacus({
  values,
  columns = 3,
  interval = 2500,
}: {
  values: number[]
  columns?: number
  interval?: number
}) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const appConfig = useAbacusConfig()

  useEffect(() => {
    if (values.length === 0) return

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % values.length)
    }, interval)

    return () => clearInterval(timer)
  }, [values, interval])

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
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      <div className={css({ transform: 'scale(0.75)', transformOrigin: 'center center' })}>
        <AbacusReact
          value={values[currentIndex] || 0}
          columns={columns}
          beadShape={appConfig.beadShape}
          customStyles={darkStyles}
        />
      </div>
    </div>
  )
}

export default function HomePage() {
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(1) // Default to "Friends techniques"
  const fullTutorial = getTutorialForEditor()

  // Create different tutorials for each skill level
  const skillTutorials = [
    // Skill 0: Read and set numbers (0-9999)
    {
      ...fullTutorial,
      id: 'read-numbers-demo',
      title: 'Read and Set Numbers',
      description: 'Master abacus number representation from zero to thousands',
      steps: fullTutorial.steps.filter((step) => step.id.startsWith('basic-')),
    },
    // Skill 1: Friends techniques (5 = 2+3)
    {
      ...fullTutorial,
      id: 'friends-of-5-demo',
      title: 'Friends of 5',
      description: 'Add and subtract using complement pairs: 5 = 2+3',
      steps: fullTutorial.steps.filter((step) => step.id === 'complement-2'),
    },
    // Skill 2: Multiply & divide (12×34)
    {
      ...fullTutorial,
      id: 'multiply-demo',
      title: 'Multiplication',
      description: 'Fluent multi-digit calculations with advanced techniques',
      steps: fullTutorial.steps.filter((step) => step.id.includes('complement')).slice(0, 3),
    },
    // Skill 3: Mental calculation (Speed math)
    {
      ...fullTutorial,
      id: 'mental-calc-demo',
      title: 'Mental Calculation',
      description: 'Visualize and compute without the physical tool (Anzan)',
      steps: fullTutorial.steps.slice(-3),
    },
  ]

  const selectedTutorial = skillTutorials[selectedSkillIndex]

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
                  <div
                    className={css({
                      flex: '1',
                      minW: { base: '100%', md: '500px' },
                      maxW: { base: '100%', md: '500px' },
                    })}
                  >
                    <TutorialPlayer
                      key={selectedTutorial.id}
                      tutorial={selectedTutorial}
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
                      w: { base: '100%', lg: '650px' },
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
                    <div className={grid({ columns: { base: 1, lg: 2 }, gap: '5' })}>
                      {[
                        {
                          title: '📖 Read and set numbers',
                          desc: 'Master abacus number representation from zero to thousands',
                          example: '0-9999',
                          badge: 'Foundation',
                          values: [0, 1, 2, 3, 4, 5, 10, 50, 100, 500, 999],
                          columns: 3,
                        },
                        {
                          title: '🤝 Friends techniques',
                          desc: 'Add and subtract using complement pairs and mental shortcuts',
                          example: '5 = 2+3',
                          badge: 'Core',
                          values: [2, 5, 3],
                          columns: 1,
                        },
                        {
                          title: '✖️ Multiply & divide',
                          desc: 'Fluent multi-digit calculations with advanced techniques',
                          example: '12×34',
                          badge: 'Advanced',
                          values: [12, 24, 36, 48],
                          columns: 2,
                        },
                        {
                          title: '🧠 Mental calculation',
                          desc: 'Visualize and compute without the physical tool (Anzan)',
                          example: 'Speed math',
                          badge: 'Expert',
                          values: [7, 14, 21, 28, 35],
                          columns: 2,
                        },
                      ].map((skill, i) => {
                        const isSelected = i === selectedSkillIndex
                        return (
                          <div
                            key={i}
                            onClick={() => setSelectedSkillIndex(i)}
                            className={css({
                              bg: isSelected
                                ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.15), rgba(250, 204, 21, 0.08))'
                                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03))',
                              borderRadius: 'xl',
                              p: { base: '4', lg: '5' },
                              border: '1px solid',
                              borderColor: isSelected
                                ? 'rgba(250, 204, 21, 0.4)'
                                : 'rgba(255, 255, 255, 0.15)',
                              boxShadow: isSelected
                                ? '0 6px 16px rgba(250, 204, 21, 0.2)'
                                : '0 4px 12px rgba(0, 0, 0, 0.3)',
                              transition: 'all 0.2s',
                              cursor: 'pointer',
                              _hover: {
                                bg: isSelected
                                  ? 'linear-gradient(135deg, rgba(250, 204, 21, 0.2), rgba(250, 204, 21, 0.12))'
                                  : 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
                                borderColor: isSelected
                                  ? 'rgba(250, 204, 21, 0.5)'
                                  : 'rgba(255, 255, 255, 0.25)',
                                transform: 'translateY(-2px)',
                                boxShadow: isSelected
                                  ? '0 8px 20px rgba(250, 204, 21, 0.3)'
                                  : '0 6px 16px rgba(0, 0, 0, 0.4)',
                              },
                            })}
                          >
                            <div className={hstack({ gap: '3', alignItems: 'flex-start' })}>
                              <div
                                className={css({
                                  fontSize: '3xl',
                                  width: { base: '120px', lg: '150px' },
                                  minHeight: { base: '115px', lg: '140px' },
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  textAlign: 'center',
                                  bg: isSelected
                                    ? 'rgba(250, 204, 21, 0.15)'
                                    : 'rgba(255, 255, 255, 0.1)',
                                  borderRadius: 'lg',
                                })}
                              >
                                <MiniAbacus values={skill.values} columns={skill.columns} />
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
                        )
                      })}
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
                  The Arcade
                </h2>
                <p className={css({ color: 'gray.400', fontSize: 'md' })}>
                  Single-player challenges and multiplayer battles in networked rooms. Invite
                  friends to play or watch live.
                </p>
              </div>

              <div className={grid({ columns: { base: 1, sm: 2, lg: 4 }, gap: '5' })}>
                {getAvailableGames().map((game) => {
                  const playersText =
                    game.manifest.maxPlayers === 1
                      ? 'Solo challenge'
                      : `1-${game.manifest.maxPlayers} players`
                  return (
                    <GameCard
                      key={game.manifest.name}
                      icon={game.manifest.icon}
                      title={game.manifest.displayName}
                      description={game.manifest.description}
                      players={playersText}
                      tags={game.manifest.chips}
                      gradient={game.manifest.gradient}
                      href="/games"
                    />
                  )
                })}
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

              <LevelSliderDisplay />
            </section>

            {/* Flashcard Generator Section */}
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
                  Create Custom Flashcards
                </h2>
                <p className={css({ color: 'gray.400', fontSize: 'md', maxW: '2xl', mx: 'auto' })}>
                  Design beautiful flashcards for learning and practice
                </p>
              </div>

              {/* Combined interactive display and CTA */}
              <div
                className={css({
                  bg: 'rgba(0, 0, 0, 0.4)',
                  rounded: 'xl',
                  p: { base: '6', md: '8' },
                  border: '1px solid',
                  borderColor: 'gray.700',
                  shadow: 'lg',
                  maxW: '1200px',
                  mx: 'auto',
                })}
              >
                {/* Interactive Flashcards Display */}
                <div className={css({ mb: '8' })}>
                  <InteractiveFlashcards />
                </div>

                {/* Features */}
                <div className={grid({ columns: { base: 1, md: 3 }, gap: '4', mb: '6' })}>
                  {[
                    {
                      icon: '📄',
                      title: 'Multiple Formats',
                      desc: 'PDF, PNG, SVG, HTML',
                    },
                    {
                      icon: '🎨',
                      title: 'Customizable',
                      desc: 'Bead shapes, colors, layouts',
                    },
                    {
                      icon: '📐',
                      title: 'All Paper Sizes',
                      desc: 'A3, A4, A5, US Letter',
                    },
                  ].map((feature, i) => (
                    <div
                      key={i}
                      className={css({
                        textAlign: 'center',
                        p: '4',
                        rounded: 'lg',
                        bg: 'rgba(255, 255, 255, 0.05)',
                      })}
                    >
                      <div className={css({ fontSize: '2xl', mb: '2' })}>{feature.icon}</div>
                      <div
                        className={css({
                          fontSize: 'sm',
                          fontWeight: 'semibold',
                          color: 'white',
                          mb: '1',
                        })}
                      >
                        {feature.title}
                      </div>
                      <div className={css({ fontSize: 'xs', color: 'gray.400' })}>
                        {feature.desc}
                      </div>
                    </div>
                  ))}
                </div>

                {/* CTA Button */}
                <div className={css({ textAlign: 'center' })}>
                  <Link
                    href="/create"
                    className={css({
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2',
                      bg: 'blue.600',
                      color: 'white',
                      px: '6',
                      py: '3',
                      rounded: 'lg',
                      fontWeight: 'semibold',
                      transition: 'all 0.2s',
                      _hover: {
                        bg: 'blue.500',
                      },
                    })}
                  >
                    <span>Create Flashcards</span>
                    <span>→</span>
                  </Link>
                </div>
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
    <Link href={href} style={{ height: '100%', display: 'block' }}>
      <div
        className={css({
          rounded: 'xl',
          p: '6',
          shadow: 'lg',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
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
        <div
          className={css({
            position: 'relative',
            zIndex: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
          })}
        >
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
