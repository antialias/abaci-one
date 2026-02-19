'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslations, useMessages } from 'next-intl'
import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { useHomeHero } from '@/contexts/HomeHeroContext'
import { PageWithNav } from '@/components/PageWithNav'
import { getTutorialForEditor, type Tutorial } from '@/utils/tutorialConverter'
import { useAvailableGames } from '@/hooks/useAllGames'
import { HomeBlogSection } from '@/components/HomeBlogSection'
import { BarChart3, Gamepad2, Users } from 'lucide-react'
import Image from 'next/image'
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

// Lazy load heavy components - skip SSR entirely for performance
const TutorialPlayer = dynamic(
  () => import('@/components/tutorial/TutorialPlayer').then((m) => m.TutorialPlayer),
  { ssr: false, loading: () => <TutorialSkeleton /> }
)

const InteractiveFlashcards = dynamic(
  () => import('@/components/InteractiveFlashcards').then((m) => m.InteractiveFlashcards),
  { ssr: false, loading: () => <FlashcardsSkeleton /> }
)

// Hero section - the actual abacus is rendered by MyAbacus component
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
      data-section="hero"
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
          data-element="hero-subtitle"
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

// Section 2: The Promise
function PromiseSection() {
  const t = useTranslations('home')

  return (
    <section
      data-section="promise"
      className={css({
        bg: 'gray.900',
        py: { base: '16', md: '24' },
        px: '4',
      })}
    >
      <div className={container({ maxW: '3xl' })}>
        <div className={stack({ gap: '6', alignItems: 'center', textAlign: 'center' })}>
          <h2
            data-element="section-title"
            className={css({
              fontSize: { base: '2xl', md: '4xl' },
              fontWeight: 'bold',
              color: 'white',
              lineHeight: '1.2',
            })}
          >
            {t('promise.title')}
          </h2>
          <p
            data-element="section-body"
            className={css({
              fontSize: { base: 'md', md: 'lg' },
              color: 'gray.300',
              lineHeight: '1.8',
              maxW: '2xl',
            })}
          >
            {t('promise.body')}
          </p>
          <Link
            href="/why-abacus"
            data-action="learn-why"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2',
              color: 'amber.400',
              fontWeight: 'semibold',
              fontSize: { base: 'md', md: 'lg' },
              transition: 'color 0.2s',
              _hover: { color: 'amber.300' },
            })}
          >
            {t('promise.learnWhy')}
          </Link>
        </div>
      </div>
    </section>
  )
}

// Section 3: The Abacus Method (reframed Learn by Doing)
function AbacusMethodSection() {
  const t = useTranslations('home')
  const messages = useMessages() as any
  const [selectedSkillIndex, setSelectedSkillIndex] = useState(1)

  const [fullTutorial, setFullTutorial] = useState<Tutorial | null>(null)

  useEffect(() => {
    setFullTutorial(getTutorialForEditor(messages.tutorial || {}))
  }, [messages.tutorial])

  const skillTutorials = useMemo(() => {
    if (!fullTutorial) return null

    return [
      {
        ...fullTutorial,
        id: 'read-numbers-demo',
        title: t('skills.readNumbers.tutorialTitle'),
        description: t('skills.readNumbers.tutorialDesc'),
        steps: fullTutorial.steps.filter((step) => step.id.startsWith('basic-')),
      },
      {
        ...fullTutorial,
        id: 'friends-of-5-demo',
        title: t('skills.friends.tutorialTitle'),
        description: t('skills.friends.tutorialDesc'),
        steps: fullTutorial.steps.filter((step) => step.id === 'complement-2'),
      },
      {
        ...fullTutorial,
        id: 'multiply-demo',
        title: t('skills.multiply.tutorialTitle'),
        description: t('skills.multiply.tutorialDesc'),
        steps: fullTutorial.steps.filter((step) => step.id.includes('complement')).slice(0, 3),
      },
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
    <section data-section="abacus-method" className={stack({ gap: '8', py: { base: '12', md: '16' }, px: '4' })}>
      <div className={container({ maxW: '7xl' })}>
        <div data-element="section-header" className={css({ textAlign: 'center', mb: '8' })}>
          <h2
            data-element="section-title"
            className={css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'bold',
              color: 'text.primary',
              mb: '3',
            })}
          >
            {t('method.title')}
          </h2>
          <p
            data-element="section-subtitle"
            className={css({
              color: 'text.secondary',
              fontSize: { base: 'sm', md: 'md' },
              maxW: '3xl',
              mx: 'auto',
              lineHeight: '1.7',
            })}
          >
            {t('method.subtitle')}
          </p>
        </div>

        {/* Live demo and learning objectives */}
        <div
          data-element="tutorial-container"
          className={css({
            bg: 'bg.surface',
            rounded: 'xl',
            p: { base: '4', md: '8' },
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
      </div>
    </section>
  )
}

// Section 4: Adaptive Practice
function AdaptivePracticeSection() {
  const t = useTranslations('home')

  const features = [
    {
      icon: BarChart3,
      title: t('practice.features.mastery.title'),
      desc: t('practice.features.mastery.desc'),
    },
    {
      icon: Gamepad2,
      title: t('practice.features.rewards.title'),
      desc: t('practice.features.rewards.desc'),
    },
    {
      icon: Users,
      title: t('practice.features.multiKid.title'),
      desc: t('practice.features.multiKid.desc'),
    },
  ]

  return (
    <section
      data-section="adaptive-practice"
      className={css({
        bg: 'gray.900',
        py: { base: '16', md: '24' },
        px: '4',
      })}
    >
      <div className={container({ maxW: '5xl' })}>
        <div className={stack({ gap: '4', alignItems: 'center', textAlign: 'center', mb: '12' })}>
          <h2
            data-element="section-title"
            className={css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'bold',
              color: 'white',
            })}
          >
            {t('practice.title')}
          </h2>
          <p
            data-element="section-subtitle"
            className={css({
              fontSize: { base: 'md', md: 'lg' },
              color: 'gray.400',
            })}
          >
            {t('practice.subtitle')}
          </p>
        </div>

        <div className={grid({ columns: { base: 1, md: 3 }, gap: '8' })}>
          {features.map((feature, i) => {
            const Icon = feature.icon
            return (
              <div
                key={i}
                data-element="practice-feature-card"
                className={css({
                  bg: 'rgba(255, 255, 255, 0.05)',
                  rounded: 'xl',
                  p: '6',
                  border: '1px solid',
                  borderColor: 'gray.700',
                })}
              >
                <div
                  className={css({
                    width: '48px',
                    height: '48px',
                    bg: 'amber.500/20',
                    rounded: 'lg',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    mb: '4',
                    color: 'amber.400',
                  })}
                >
                  <Icon size={24} />
                </div>
                <h3
                  className={css({
                    fontSize: 'lg',
                    fontWeight: 'bold',
                    color: 'white',
                    mb: '2',
                  })}
                >
                  {feature.title}
                </h3>
                <p
                  className={css({
                    fontSize: 'sm',
                    color: 'gray.400',
                    lineHeight: '1.6',
                  })}
                >
                  {feature.desc}
                </p>
              </div>
            )
          })}
        </div>

        <div className={css({ textAlign: 'center', mt: '10' })}>
          <Link
            href="/practice"
            data-action="start-practicing"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2',
              bg: 'amber.500',
              color: 'gray.900',
              px: '8',
              py: '3',
              rounded: 'lg',
              fontWeight: 'bold',
              fontSize: 'lg',
              transition: 'all 0.2s',
              _hover: {
                bg: 'amber.400',
                transform: 'translateY(-1px)',
              },
            })}
          >
            <span>{t('practice.cta')}</span>
            <span>→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

// Section 5: The Arcade
function ArcadeSection() {
  const t = useTranslations('home')
  const availableGames = useAvailableGames()

  return (
    <section data-section="arcade" className={stack({ gap: '6', py: { base: '12', md: '16' }, px: '4' })}>
      <div className={container({ maxW: '7xl' })}>
        <div className={css({ textAlign: 'center', mb: '8' })}>
          <h2
            data-element="section-title"
            className={css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'bold',
              color: 'text.primary',
              mb: '2',
            })}
          >
            {t('arcade.title')}
          </h2>
          <p className={css({ color: 'text.secondary', fontSize: 'md', maxW: '2xl', mx: 'auto' })}>
            {t('arcade.subtitle')}
          </p>
        </div>

        <div className={grid({ columns: { base: 1, sm: 2, lg: 4 }, gap: '5' })}>
          {availableGames.map((game) => {
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
      </div>
    </section>
  )
}

// Section 6: Explorations
function ExplorationsSection() {
  const t = useTranslations('home')

  const toys = [
    {
      title: t('explorations.euclid.title'),
      desc: t('explorations.euclid.desc'),
      href: '/toys/euclid',
      previewId: 'euclid-prop1',
      gradient: 'linear-gradient(135deg, #1a365d 0%, #2d3748 100%)',
    },
    {
      title: t('explorations.constantDemos.title'),
      desc: t('explorations.constantDemos.desc'),
      href: '/toys/number-line',
      previewId: 'numberline-pi',
      gradient: 'linear-gradient(135deg, #22543d 0%, #2d3748 100%)',
    },
    {
      title: t('explorations.talkToNumber.title'),
      desc: t('explorations.talkToNumber.desc'),
      href: '/toys/number-line',
      previewId: 'numberline-call',
      gradient: 'linear-gradient(135deg, #44337a 0%, #2d3748 100%)',
    },
    {
      title: t('explorations.coordinatePlane.title'),
      desc: t('explorations.coordinatePlane.desc'),
      href: '/toys/coordinate-plane',
      previewId: 'coordinate-plane',
      gradient: 'linear-gradient(135deg, #553c9a 0%, #2d3748 100%)',
    },
    {
      title: t('explorations.dice.title'),
      desc: t('explorations.dice.desc'),
      href: '/toys/dice',
      previewId: 'dice-tray',
      gradient: 'linear-gradient(135deg, #9c4221 0%, #2d3748 100%)',
    },
  ]

  return (
    <section
      data-section="explorations"
      className={css({
        bg: 'gray.900',
        py: { base: '12', md: '16' },
        px: '4',
      })}
    >
      <div className={container({ maxW: '7xl' })}>
        <div className={css({ textAlign: 'center', mb: '8' })}>
          <h2
            data-element="section-title"
            className={css({
              fontSize: { base: '2xl', md: '3xl' },
              fontWeight: 'bold',
              color: 'white',
              mb: '2',
            })}
          >
            {t('explorations.title')}
          </h2>
          <p
            data-element="section-subtitle"
            className={css({
              color: 'gray.400',
              fontSize: 'md',
              maxW: '2xl',
              mx: 'auto',
            })}
          >
            {t('explorations.subtitle')}
          </p>
        </div>

        <div className={grid({ columns: { base: 1, sm: 2, lg: 3 }, gap: '5' })}>
          {toys.map((toy) => (
            <ExplorationCard key={toy.previewId} {...toy} />
          ))}
        </div>
      </div>
    </section>
  )
}

function ExplorationCard({
  title,
  desc,
  href,
  previewId,
  gradient,
}: {
  title: string
  desc: string
  href: string
  previewId: string
  gradient: string
}) {
  const [imgError, setImgError] = useState(false)

  return (
    <Link href={href} style={{ height: '100%', display: 'block' }}>
      <div
        data-element="exploration-card"
        data-preview-id={previewId}
        className={css({
          rounded: 'xl',
          shadow: 'lg',
          transition: 'all 0.3s ease',
          cursor: 'pointer',
          position: 'relative',
          overflow: 'hidden',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '200px',
          _hover: {
            transform: 'translateY(-4px)',
            shadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
          },
        })}
      >
        {/* Background: preview image or gradient fallback */}
        {!imgError && (
          <Image
            src={`/images/homepage/${previewId}.png`}
            alt=""
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className={css({
              objectFit: 'cover',
              zIndex: 0,
            })}
            onError={() => setImgError(true)}
          />
        )}
        <div
          style={{ background: imgError ? gradient : undefined }}
          className={css({
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            ...(!imgError ? {} : {}),
          })}
        />
        {/* Dark gradient overlay for text readability */}
        <div
          className={css({
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
            zIndex: 1,
          })}
        />
        {/* Content pinned to bottom */}
        <div
          className={css({
            position: 'relative',
            zIndex: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            p: '6',
          })}
        >
          <h3
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              color: 'white',
              mb: '1',
              textShadow: '0 2px 8px rgba(0, 0, 0, 0.5)',
            })}
          >
            {title}
          </h3>
          <p
            className={css({
              fontSize: 'sm',
              color: 'gray.300',
              lineHeight: '1.5',
              textShadow: '0 1px 4px rgba(0, 0, 0, 0.4)',
            })}
          >
            {desc}
          </p>
        </div>
      </div>
    </Link>
  )
}

// Section 7: Printable Tools
function PrintableToolsSection() {
  const t = useTranslations('home')

  return (
    <section data-section="printable-tools" className={stack({ gap: '8', py: { base: '12', md: '16' }, px: '4' })}>
      <div className={container({ maxW: '7xl' })}>
        <div className={css({ textAlign: 'center', mb: '8' })}>
          <h2
            data-element="section-title"
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
          <div className={css({ mb: '8' })}>
            <InteractiveFlashcards />
          </div>

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
                data-element="flashcard-feature"
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

          <div className={css({ textAlign: 'center' })}>
            <Link
              href="/create"
              data-action="create-materials"
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
      </div>
    </section>
  )
}

// Section 8: Built by a Parent
function BuiltByParentSection() {
  const t = useTranslations('home')

  return (
    <section
      data-section="built-by-parent"
      className={css({
        bg: 'gray.900',
        py: { base: '16', md: '20' },
        px: '4',
      })}
    >
      <div className={container({ maxW: '3xl' })}>
        <p
          data-element="statement"
          className={css({
            textAlign: 'center',
            fontSize: { base: 'lg', md: 'xl' },
            color: 'gray.300',
            lineHeight: '1.8',
            fontStyle: 'italic',
          })}
        >
          {t('builtBy.statement')}
        </p>
      </div>
    </section>
  )
}

// Section 9: Get Started CTA
function GetStartedSection() {
  const t = useTranslations('home')

  return (
    <section
      data-section="get-started"
      className={css({
        py: { base: '16', md: '24' },
        px: '4',
      })}
    >
      <div className={container({ maxW: '3xl' })}>
        <div className={stack({ gap: '6', alignItems: 'center', textAlign: 'center' })}>
          <h2
            data-element="section-title"
            className={css({
              fontSize: { base: '2xl', md: '4xl' },
              fontWeight: 'bold',
              color: 'white',
            })}
          >
            {t('getStarted.title')}
          </h2>
          <p
            data-element="section-subtitle"
            className={css({
              fontSize: { base: 'md', md: 'lg' },
              color: 'gray.400',
              maxW: '2xl',
            })}
          >
            {t('getStarted.subtitle')}
          </p>
          <Link
            href="/practice"
            data-action="get-started"
            className={css({
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2',
              bg: 'amber.500',
              color: 'gray.900',
              px: '10',
              py: '4',
              rounded: 'xl',
              fontWeight: 'bold',
              fontSize: 'xl',
              transition: 'all 0.2s',
              _hover: {
                bg: 'amber.400',
                transform: 'translateY(-2px)',
                shadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
              },
            })}
          >
            <span>{t('getStarted.cta')}</span>
            <span>→</span>
          </Link>
          <Link
            href="/for-teachers"
            data-action="for-teachers"
            className={css({
              color: 'gray.400',
              fontSize: 'sm',
              transition: 'color 0.2s',
              _hover: { color: 'amber.400' },
            })}
          >
            {t('getStarted.forTeachers')}
          </Link>
        </div>
      </div>
    </section>
  )
}

export default function HomePage() {
  return (
    <PageWithNav>
      <div className={css({ bg: 'bg.canvas', minHeight: '100vh' })}>
        {/* 1. Hero */}
        <HeroSection />

        {/* 2. The Promise */}
        <PromiseSection />

        {/* 3. The Abacus Method */}
        <AbacusMethodSection />

        {/* 4. Adaptive Practice */}
        <AdaptivePracticeSection />

        {/* 5. The Arcade */}
        <ArcadeSection />

        {/* 6. Explorations */}
        <ExplorationsSection />

        {/* 7. Printable Tools */}
        <PrintableToolsSection />

        {/* 8. Built by a Parent */}
        <BuiltByParentSection />

        {/* 9. Get Started */}
        <GetStartedSection />

        {/* 10. Blog */}
        <section data-section="blog" className={css({ py: { base: '12', md: '16' }, px: '4' })}>
          <div className={container({ maxW: '7xl' })}>
            <HomeBlogSection />
          </div>
        </section>
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
        data-element="game-card"
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
