'use client'

import Link from 'next/link'
import { PageWithNav } from '@/components/PageWithNav'
import { TutorialPlayer } from '@/components/tutorial/TutorialPlayer'
import { getTutorialForEditor } from '@/utils/tutorialConverter'
import { css } from '../../styled-system/css'
import { container, grid, hstack, stack } from '../../styled-system/patterns'

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
    <PageWithNav navTitle="Soroban Learning Platform" navEmoji="🧮">
      <div className={css({ bg: 'gray.900', minHeight: '100vh' })}>
        {/* Hero Section */}
        <div
          className={css({
            background:
              'linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(88, 28, 135, 0.3) 50%, rgba(17, 24, 39, 1) 100%)',
            color: 'white',
            py: { base: '12', md: '16' },
            position: 'relative',
            overflow: 'hidden',
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

          <div className={container({ maxW: '6xl', px: '4', position: 'relative' })}>
            <div className={css({ textAlign: 'center', maxW: '5xl', mx: 'auto' })}>
              {/* Main headline */}
              <h1
                className={css({
                  fontSize: { base: '3xl', md: '5xl', lg: '6xl' },
                  fontWeight: 'bold',
                  mb: '4',
                  lineHeight: 'tight',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                })}
              >
                A structured path to soroban fluency
              </h1>

              {/* Subtitle */}
              <p
                className={css({
                  fontSize: { base: 'lg', md: 'xl' },
                  color: 'gray.300',
                  mb: '6',
                  maxW: '3xl',
                  mx: 'auto',
                  lineHeight: '1.6',
                })}
              >
                Designed for self-directed learning. Start where you are, practice the skills you
                need, play games that reinforce concepts.
              </p>

              {/* Dev status badge */}
              <div
                className={css({
                  display: 'inline-block',
                  px: '4',
                  py: '2',
                  bg: 'rgba(139, 92, 246, 0.15)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  borderRadius: 'full',
                  fontSize: 'sm',
                  color: 'purple.300',
                  mb: '8',
                })}
              >
                🏗️ Curriculum system in active development
              </div>

              {/* Visual learning journey */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '2',
                  mb: '8',
                  flexWrap: 'wrap',
                })}
              >
                {[
                  { icon: '📖', label: 'Learn' },
                  { icon: '→', label: '', isArrow: true },
                  { icon: '✏️', label: 'Practice' },
                  { icon: '→', label: '', isArrow: true },
                  { icon: '🎮', label: 'Play' },
                  { icon: '→', label: '', isArrow: true },
                  { icon: '🎯', label: 'Master' },
                ].map((step, i) => (
                  <div
                    key={i}
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '1',
                      opacity: step.isArrow ? 0.5 : 1,
                    })}
                  >
                    <div
                      className={css({
                        fontSize: step.isArrow ? 'xl' : '2xl',
                        color: step.isArrow ? 'gray.500' : 'yellow.400',
                      })}
                    >
                      {step.icon}
                    </div>
                    {step.label && (
                      <div className={css({ fontSize: 'xs', color: 'gray.400' })}>{step.label}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Primary CTAs */}
              <div className={hstack({ gap: '4', justify: 'center', flexWrap: 'wrap' })}>
                <Link
                  href="/guide"
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
                  📚 Start Learning
                </Link>
                <Link
                  href="/games"
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
                  🎮 Practice Through Games
                </Link>
              </div>
            </div>
          </div>
        </div>

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

            <div className={grid({ columns: { base: 1, lg: 2 }, gap: '8' })}>
              {/* Live demo */}
              <div
                className={css({
                  bg: 'rgba(0, 0, 0, 0.4)',
                  rounded: 'xl',
                  p: '6',
                  border: '1px solid',
                  borderColor: 'gray.700',
                  shadow: 'lg',
                })}
              >
                <TutorialPlayer
                  tutorial={friendsOf5Tutorial}
                  isDebugMode={false}
                  showDebugPanel={false}
                />
              </div>

              {/* What you'll learn */}
              <div
                className={stack({
                  gap: '4',
                  bg: 'rgba(0, 0, 0, 0.4)',
                  p: '6',
                  borderRadius: 'xl',
                  border: '1px solid',
                  borderColor: 'gray.700',
                  justifyContent: 'center',
                })}
              >
                <h3 className={css({ fontSize: 'xl', fontWeight: 'bold', color: 'white' })}>
                  What You'll Learn
                </h3>
                <div className={stack({ gap: '3' })}>
                  {[
                    'Read and set numbers on an abacus',
                    'Add and subtract with "friends" techniques',
                    'Multiply and divide fluently',
                    'Calculate mentally without the abacus',
                  ].map((skill, i) => (
                    <div key={i} className={hstack({ gap: '3' })}>
                      <span className={css({ color: 'yellow.400', fontSize: 'lg' })}>✓</span>
                      <span className={css({ color: 'gray.300', fontSize: 'md' })}>{skill}</span>
                    </div>
                  ))}
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
                Simple enough for kids to start on their own, structured enough for parents to trust
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
              <p className={css({ color: 'gray.400', fontSize: 'md' })}>
                Progress from beginner to master
              </p>
            </div>

            <div
              className={css({
                bg: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid',
                borderColor: 'gray.700',
                rounded: 'xl',
                p: '8',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '4',
                  flexWrap: 'wrap',
                })}
              >
                {[
                  { level: '10 Kyu', label: 'Beginner', color: 'green.400' },
                  { level: '5 Kyu', label: 'Intermediate', color: 'blue.400' },
                  { level: '1 Kyu', label: 'Advanced', color: 'purple.400' },
                  { level: 'Dan', label: 'Master', color: 'yellow.400' },
                ].map((stage, i) => (
                  <div key={i} className={stack({ gap: '2', textAlign: 'center', flex: '1' })}>
                    <div
                      className={css({
                        fontSize: 'xl',
                        fontWeight: 'bold',
                        color: stage.color,
                      })}
                    >
                      {stage.level}
                    </div>
                    <div className={css({ fontSize: 'sm', color: 'gray.400' })}>{stage.label}</div>
                    {i < 3 && (
                      <div
                        className={css({
                          display: { base: 'none', md: 'block' },
                          position: 'absolute',
                          right: '-50%',
                          fontSize: 'xl',
                          color: 'gray.600',
                        })}
                      >
                        →
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div
                className={css({
                  mt: '6',
                  textAlign: 'center',
                  fontSize: 'sm',
                  color: 'gray.500',
                  fontStyle: 'italic',
                })}
              >
                You'll progress through all these levels eventually ↑
              </div>
            </div>
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
