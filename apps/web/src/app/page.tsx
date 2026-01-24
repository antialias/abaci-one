'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslations, useMessages } from 'next-intl'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { useHomeHero } from '@/contexts/HomeHeroContext'
import { PageWithNav } from '@/components/PageWithNav'
import { getTutorialForEditor, type Tutorial } from '@/utils/tutorialConverter'
import { getAvailableGames } from '@/lib/arcade/game-registry'
import { HomeBlogSection } from '@/components/HomeBlogSection'
import { css } from '../../styled-system/css'
import { container, grid, hstack, stack } from '../../styled-system/patterns'

// Skeleton placeholders for lazy-loaded components
function TutorialSkeleton() {
  return (
    <div
      className={css({
        width: '100%',
        maxWidth: '250px',
        height: '300px',
        bg: 'bg.muted',
        rounded: 'lg',
        animation: 'pulse 2s ease-in-out infinite',
      })}
    />
  )
}

function FlashcardsSkeleton() {
  return (
    <div
      className={css({
        width: '100%',
        height: '200px',
        bg: 'bg.muted',
        rounded: 'lg',
        animation: 'pulse 2s ease-in-out infinite',
      })}
    />
  )
}

function LevelSliderSkeleton() {
  return (
    <div
      className={css({
        width: '100%',
        height: '120px',
        bg: 'bg.muted',
        rounded: 'lg',
        animation: 'pulse 2s ease-in-out infinite',
      })}
    />
  )
}

// Lazy load heavy components - skip SSR entirely for performance
const TutorialPlayer = dynamic(
  () => import('@/components/tutorial/TutorialPlayer').then((m) => m.TutorialPlayer),
  { ssr: false, loading: () => <TutorialSkeleton /> }
)

const InteractiveFlashcards = dynamic(
  () => import('@/components/InteractiveFlashcards').then((m) => m.InteractiveFlashcards),
  { ssr: false, loading: () => <FlashcardsSkeleton /> }
)

const LevelSliderDisplay = dynamic(
  () => import('@/components/LevelSliderDisplay').then((m) => m.LevelSliderDisplay),
  { ssr: false, loading: () => <LevelSliderSkeleton /> }
)

// Hero section placeholder - the actual abacus is rendered by MyAbacus component
function HeroSection() {
  const { subtitle, setIsHeroVisible, isSubtitleLoaded } = useHomeHero()
  const heroRef = useRef<HTMLDivElement>(null)

  // Detect when hero scrolls out of view
  useEffect(() => {
    if (!heroRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsHeroVisible(entry.intersectionRatio > 0.2)
      },
      {
        threshold: [0, 0.2, 0.5, 1],
      }
    )

    observer.observe(heroRef.current)
    return () => observer.disconnect()
  }, [setIsHeroVisible])

  return (
    <div
      ref={heroRef}
      className={css({
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        bg: 'bg.canvas',
        position: 'relative',
        overflow: 'hidden',
        px: '4',
        py: '12',
      })}
    >
      {/* Background pattern */}
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

      {/* Title and Subtitle */}
      <div
        className={css({
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          zIndex: 10,
        })}
      >
        <h1
          className={css({
            fontSize: { base: '4xl', md: '6xl', lg: '7xl' },
            fontWeight: 'bold',
            background:
              'linear-gradient(135deg, token(colors.amber.400) 0%, token(colors.amber.500) 50%, token(colors.amber.400) 100%)',
            backgroundClip: 'text',
            color: 'transparent',
          })}
        >
          Abaci One
        </h1>
        <p
          className={css({
            fontSize: { base: 'xl', md: '2xl' },
            fontWeight: 'medium',
            color: 'accent.emphasis',
            fontStyle: 'italic',
            marginBottom: '8',
            opacity: isSubtitleLoaded ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out',
          })}
        >
          {subtitle.text}
        </p>
      </div>

      {/* Space for abacus - rendered by MyAbacus component in hero mode */}
      <div className={css({ flex: 1 })} />

      {/* Scroll hint */}
      <div
        className={css({
          position: 'relative',
          fontSize: 'sm',
          color: 'text.muted',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2',
          animation: 'bounce 2s ease-in-out infinite',
          zIndex: 10,
        })}
      >
        <span>Scroll to explore</span>
        <span>↓</span>
      </div>

      {/* Keyframes for bounce animation */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @keyframes bounce {
              0%, 100% {
                transform: translateY(0);
                opacity: 0.7;
              }
              50% {
                transform: translateY(-10px);
                opacity: 1;
              }
            }
          `,
        }}
      />
    </div>
  )
}

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
      <div
        className={css({
          transform: 'scale(0.75)',
          transformOrigin: 'center center',
        })}
      >
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
  const t = useTranslations('home')
  const messages = useMessages() as any
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(1) // Default to "Friends techniques"

  // Defer tutorial processing to after hydration for better SSR performance
  const [fullTutorial, setFullTutorial] = useState<Tutorial | null>(null)

  useEffect(() => {
    // Process tutorial data after hydration to avoid blocking SSR
    setFullTutorial(getTutorialForEditor(messages.tutorial || {}))
  }, [messages.tutorial])

  // Create different tutorials for each skill level (memoized to avoid recalc on every render)
  const skillTutorials = useMemo(() => {
    if (!fullTutorial) return null

    return [
      // Skill 0: Read and set numbers (0-9999)
      {
        ...fullTutorial,
        id: 'read-numbers-demo',
        title: t('skills.readNumbers.tutorialTitle'),
        description: t('skills.readNumbers.tutorialDesc'),
        steps: fullTutorial.steps.filter((step) => step.id.startsWith('basic-')),
      },
      // Skill 1: Friends techniques (5 = 2+3)
      {
        ...fullTutorial,
        id: 'friends-of-5-demo',
        title: t('skills.friends.tutorialTitle'),
        description: t('skills.friends.tutorialDesc'),
        steps: fullTutorial.steps.filter((step) => step.id === 'complement-2'),
      },
      // Skill 2: Multiply & divide (12×34)
      {
        ...fullTutorial,
        id: 'multiply-demo',
        title: t('skills.multiply.tutorialTitle'),
        description: t('skills.multiply.tutorialDesc'),
        steps: fullTutorial.steps.filter((step) => step.id.includes('complement')).slice(0, 3),
      },
      // Skill 3: Mental calculation (Speed math)
      {
        ...fullTutorial,
        id: 'mental-calc-demo',
        title: t('skills.mental.tutorialTitle'),
        description: t('skills.mental.tutorialDesc'),
        steps: fullTutorial.steps.slice(-3),
      },
    ]
  }, [fullTutorial, t])

  const selectedTutorial = skillTutorials?.[selectedSkillIndex] ?? null

  return (
    <PageWithNav>
      <div className={css({ bg: 'bg.canvas', minHeight: '100vh' })}>
        {/* Hero Section - abacus rendered by MyAbacus in hero mode */}
        <HeroSection />

        {/* Blog + Learn by Doing - Responsive 2 Column Layout */}
        <div
          data-section="home-two-column"
          className={css({
            display: 'grid',
            gridTemplateColumns: { base: '1fr', md: '1fr 2fr' },
            gap: { base: '8', md: '12' },
            px: '4',
            py: { base: '8', md: '12' },
            maxW: { base: '7xl', md: '90%', xl: '1600px' },
            mx: 'auto',
          })}
        >
          {/* Blog Section (Left Column) */}
          <div data-section="blog-column">
            <HomeBlogSection />
          </div>

          {/* Learn by Doing Section (Right Column) */}
          <section data-section="learn-by-doing" className={stack({ gap: '8' })}>
            <div data-element="section-header" className={css({ textAlign: 'center' })}>
              <h2
                data-element="section-title"
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: 'bold',
                  color: 'text.primary',
                  mb: '2',
                })}
              >
                {t('learnByDoing.title')}
              </h2>
              <p
                data-element="section-subtitle"
                className={css({
                  color: 'text.secondary',
                  fontSize: 'md',
                  maxW: '2xl',
                  mx: 'auto',
                })}
              >
                {t('learnByDoing.subtitle')}
              </p>
            </div>

            {/* Live demo and learning objectives */}
            <div
              data-element="tutorial-container"
              className={css({
                bg: 'bg.surface',
                rounded: 'xl',
                p: '8',
                border: '1px solid',
                borderColor: 'border.default',
                shadow: 'lg',
                w: '100%',
                maxW: '100%',
              })}
            >
              <div
                data-element="tutorial-flex-container"
                className={css({
                  display: 'flex',
                  flexDirection: { base: 'column', xl: 'row' },
                  gap: '8',
                  alignItems: { base: 'center', xl: 'flex-start' },
                })}
              >
                {/* Tutorial on the left */}
                <div
                  data-element="tutorial-player-wrapper"
                  className={css({
                    flex: '1',
                    w: '100%',
                    maxW: '250px',
                  })}
                >
                  {selectedTutorial ? (
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
                  ) : (
                    <TutorialSkeleton />
                  )}
                </div>

                {/* What you'll learn on the right */}
                <div
                  data-element="skills-grid-wrapper"
                  className={css({
                    flex: '1',
                    w: '100%',
                    maxW: '100%',
                  })}
                >
                  <h3
                    data-element="skills-grid-title"
                    className={css({
                      fontSize: '2xl',
                      fontWeight: 'bold',
                      color: 'white',
                      mb: '6',
                    })}
                  >
                    {t('whatYouLearn.title')}
                  </h3>
                  <div
                    data-element="skills-grid"
                    className={grid({ columns: { base: 1, lg: 2 }, gap: '5' })}
                  >
                    {[
                      {
                        title: t('skills.readNumbers.title'),
                        desc: t('skills.readNumbers.desc'),
                        example: t('skills.readNumbers.example'),
                        badge: t('skills.readNumbers.badge'),
                        values: [0, 1, 2, 3, 4, 5, 10, 50, 100, 500, 999],
                        columns: 3,
                      },
                      {
                        title: t('skills.friends.title'),
                        desc: t('skills.friends.desc'),
                        example: t('skills.friends.example'),
                        badge: t('skills.friends.badge'),
                        values: [2, 5, 3],
                        columns: 1,
                      },
                      {
                        title: t('skills.multiply.title'),
                        desc: t('skills.multiply.desc'),
                        example: t('skills.multiply.example'),
                        badge: t('skills.multiply.badge'),
                        values: [12, 24, 36, 48],
                        columns: 2,
                      },
                      {
                        title: t('skills.mental.title'),
                        desc: t('skills.mental.desc'),
                        example: t('skills.mental.example'),
                        badge: t('skills.mental.badge'),
                        values: [7, 14, 21, 28, 35],
                        columns: 2,
                      },
                    ].map((skill, i) => {
                      const isSelected = i === selectedSkillIndex
                      const skillNames = ['read-numbers', 'friends', 'multiply', 'mental']
                      return (
                        <div
                          key={i}
                          data-element="skill-card"
                          data-skill={skillNames[i]}
                          data-selected={isSelected}
                          onClick={() => setSelectedSkillIndex(i)}
                          className={css({
                            bg: isSelected ? 'accent.subtle' : 'bg.surface',
                            borderRadius: 'xl',
                            p: { base: '4', lg: '5' },
                            border: '1px solid',
                            borderColor: isSelected ? 'accent.default' : 'border.default',
                            boxShadow: isSelected
                              ? '0 6px 16px token(colors.accent.muted)'
                              : '0 4px 12px token(colors.bg.muted)',
                            transition: 'all 0.2s',
                            cursor: 'pointer',
                            _hover: {
                              bg: isSelected ? 'accent.muted' : 'interactive.hover',
                              borderColor: isSelected ? 'accent.emphasis' : 'border.emphasis',
                              transform: 'translateY(-2px)',
                              boxShadow: isSelected
                                ? '0 8px 20px token(colors.accent.muted)'
                                : '0 6px 16px token(colors.bg.muted)',
                            },
                          })}
                        >
                          <div
                            data-element="skill-card-content"
                            className={hstack({
                              gap: '3',
                              alignItems: 'flex-start',
                            })}
                          >
                            <div
                              data-element="skill-abacus-container"
                              className={css({
                                fontSize: '3xl',
                                width: { base: '80px', lg: '100px' },
                                minHeight: { base: '90px', lg: '110px' },
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                bg: isSelected ? 'accent.muted' : 'bg.muted',
                                borderRadius: 'lg',
                              })}
                            >
                              <MiniAbacus values={skill.values} columns={skill.columns} />
                            </div>
                            <div
                              data-element="skill-info"
                              className={stack({
                                gap: '2',
                                flex: '1',
                                minWidth: '0',
                              })}
                            >
                              <div
                                data-element="skill-header"
                                className={hstack({
                                  gap: '2',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                })}
                              >
                                <div
                                  data-element="skill-title"
                                  className={css({
                                    color: 'text.primary',
                                    fontSize: 'md',
                                    fontWeight: 'bold',
                                  })}
                                >
                                  {skill.title}
                                </div>
                                <div
                                  data-element="skill-badge"
                                  className={css({
                                    bg: 'accent.muted',
                                    color: 'accent.emphasis',
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
                                data-element="skill-description"
                                className={css({
                                  color: 'text.secondary',
                                  fontSize: 'xs',
                                  lineHeight: '1.5',
                                })}
                              >
                                {skill.desc}
                              </div>
                              <div
                                data-element="skill-example"
                                className={css({
                                  color: 'accent.emphasis',
                                  fontSize: 'xs',
                                  fontFamily: 'mono',
                                  fontWeight: 'semibold',
                                  mt: '1',
                                  bg: 'accent.subtle',
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
        </div>

        {/* Main content container */}
        <div className={container({ maxW: '7xl', px: '4', py: '12' })}>
          {/* Current Offerings Section */}
          <section className={stack({ gap: '6', mb: '16' })}>
            <div className={css({ textAlign: 'center' })}>
              <h2
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: 'bold',
                  color: 'text.primary',
                  mb: '2',
                })}
              >
                {t('arcade.title')}
              </h2>
              <p className={css({ color: 'text.secondary', fontSize: 'md' })}>
                {t('arcade.subtitle')}
              </p>
            </div>

            <div className={grid({ columns: { base: 1, sm: 2, lg: 4 }, gap: '5' })}>
              {getAvailableGames().map((game) => {
                const playersText =
                  game.manifest.maxPlayers === 1
                    ? t('arcade.soloChallenge')
                    : t('arcade.playersCount', {
                        min: 1,
                        max: game.manifest.maxPlayers,
                      })
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
          <section className={stack({ gap: '6', mb: '16', overflow: 'hidden' })}>
            <div className={css({ textAlign: 'center' })}>
              <h2
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: 'bold',
                  color: 'text.primary',
                  mb: '2',
                })}
              >
                {t('journey.title')}
              </h2>
              <p className={css({ color: 'text.secondary', fontSize: 'md' })}>
                {t('journey.subtitle')}
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
                {t('flashcards.title')}
              </h2>
              <p
                className={css({
                  color: 'gray.400',
                  fontSize: 'md',
                  maxW: '2xl',
                  mx: 'auto',
                })}
              >
                {t('flashcards.subtitle')}
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
              <div
                className={grid({
                  columns: { base: 1, md: 3 },
                  gap: '4',
                  mb: '6',
                })}
              >
                {[
                  {
                    icon: t('flashcards.features.formats.icon'),
                    title: t('flashcards.features.formats.title'),
                    desc: t('flashcards.features.formats.desc'),
                  },
                  {
                    icon: t('flashcards.features.customizable.icon'),
                    title: t('flashcards.features.customizable.title'),
                    desc: t('flashcards.features.customizable.desc'),
                  },
                  {
                    icon: t('flashcards.features.paperSizes.icon'),
                    title: t('flashcards.features.paperSizes.title'),
                    desc: t('flashcards.features.paperSizes.desc'),
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
                    <div className={css({ fontSize: 'xs', color: 'gray.400' })}>{feature.desc}</div>
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
                  <span>{t('flashcards.cta')}</span>
                  <span>→</span>
                </Link>
              </div>
            </div>
          </section>
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
              color: 'text.inverse',
              mb: '2',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
            })}
          >
            {title}
          </h3>
          <p
            className={css({
              fontSize: 'sm',
              color: 'text.inverse',
              mb: '2',
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
            })}
          >
            {description}
          </p>
          <p
            className={css({
              fontSize: 'xs',
              color: 'text.inverse',
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
                  color: 'text.inverse',
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
        <h2
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: 'white',
          })}
        >
          {title}
        </h2>
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
