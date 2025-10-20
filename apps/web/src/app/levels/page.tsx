'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'
import { container, stack } from '../../../styled-system/patterns'

// Kyu level data from the Japan Abacus Federation
const kyuLevels = [
  { level: '10th Kyu', emoji: '🧒', color: 'green', digits: 2 },
  { level: '9th Kyu', emoji: '🧒', color: 'green', digits: 2 },
  { level: '8th Kyu', emoji: '🧒', color: 'green', digits: 3 },
  { level: '7th Kyu', emoji: '🧒', color: 'green', digits: 4 },
  { level: '6th Kyu', emoji: '🧑', color: 'blue', digits: 5 },
  { level: '5th Kyu', emoji: '🧑', color: 'blue', digits: 6 },
  { level: '4th Kyu', emoji: '🧑', color: 'blue', digits: 7 },
  { level: '3rd Kyu', emoji: '🧔', color: 'violet', digits: 8 },
  { level: '2nd Kyu', emoji: '🧔', color: 'violet', digits: 9 },
  { level: '1st Kyu', emoji: '🧔', color: 'violet', digits: 10 },
] as const

// Dan level data - all use 30-digit calculations
const danLevels = [
  { level: 'Pre-1st Dan', name: 'Jun-Shodan', minScore: 90, emoji: '🧙', digits: 30 },
  { level: '1st Dan', name: 'Shodan', minScore: 100, emoji: '🧙', digits: 30 },
  { level: '2nd Dan', name: 'Nidan', minScore: 120, emoji: '🧙‍♂️', digits: 30 },
  { level: '3rd Dan', name: 'Sandan', minScore: 140, emoji: '🧙‍♂️', digits: 30 },
  { level: '4th Dan', name: 'Yondan', minScore: 160, emoji: '🧙‍♀️', digits: 30 },
  { level: '5th Dan', name: 'Godan', minScore: 180, emoji: '🧙‍♀️', digits: 30 },
  { level: '6th Dan', name: 'Rokudan', minScore: 200, emoji: '🧝', digits: 30 },
  { level: '7th Dan', name: 'Nanadan', minScore: 220, emoji: '🧝', digits: 30 },
  { level: '8th Dan', name: 'Hachidan', minScore: 250, emoji: '🧝‍♂️', digits: 30 },
  { level: '9th Dan', name: 'Kudan', minScore: 270, emoji: '🧝‍♀️', digits: 30 },
  { level: '10th Dan', name: 'Judan', minScore: 290, emoji: '👑', digits: 30 },
] as const

// Compact abacus column component
function AbacusColumn({ color }: { color: string }) {
  return (
    <div
      className={css({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0.5',
        w: '2',
      })}
    >
      {/* Top bead */}
      <div
        className={css({
          w: '2',
          h: '2',
          rounded: 'full',
          bg:
            color === 'green'
              ? 'green.500'
              : color === 'blue'
                ? 'blue.500'
                : color === 'violet'
                  ? 'violet.500'
                  : 'amber.500',
          opacity: 0.7,
        })}
      />
      {/* Divider */}
      <div className={css({ w: '2', h: '0.5', bg: 'gray.600' })} />
      {/* Bottom beads */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className={css({
            w: '2',
            h: '2',
            rounded: 'full',
            bg:
              color === 'green'
                ? 'green.500'
                : color === 'blue'
                  ? 'blue.500'
                  : color === 'violet'
                    ? 'violet.500'
                    : 'amber.500',
            opacity: 0.7,
          })}
        />
      ))}
    </div>
  )
}

// Level card component for the slider
function LevelCard({
  level,
  emoji,
  color,
  digits,
  subtitle,
}: {
  level: string
  emoji: string
  color: string
  digits: number
  subtitle?: string
}) {
  // Limit display for very high digit counts
  const displayDigits = Math.min(digits, 15)
  const showEllipsis = digits > 15

  return (
    <div
      className={css({
        minW: { base: '64', md: '80' },
        bg: 'rgba(0, 0, 0, 0.4)',
        border: '2px solid',
        borderColor:
          color === 'green'
            ? 'green.500'
            : color === 'blue'
              ? 'blue.500'
              : color === 'violet'
                ? 'violet.500'
                : 'amber.500',
        rounded: 'xl',
        p: { base: '4', md: '6' },
        transition: 'all 0.2s',
        _hover: {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 16px rgba(0, 0, 0, 0.4)',
        },
      })}
    >
      {/* Header */}
      <div className={css({ textAlign: 'center', mb: '4' })}>
        <div className={css({ fontSize: { base: '3xl', md: '4xl' }, mb: '2' })}>{emoji}</div>
        <div
          className={css({
            fontSize: { base: 'lg', md: 'xl' },
            fontWeight: 'bold',
            color:
              color === 'green'
                ? 'green.400'
                : color === 'blue'
                  ? 'blue.400'
                  : color === 'violet'
                    ? 'violet.400'
                    : 'amber.400',
            mb: '1',
          })}
        >
          {level}
        </div>
        {subtitle && <div className={css({ fontSize: 'sm', color: 'gray.400' })}>{subtitle}</div>}
      </div>

      {/* Abacus Visualization */}
      <div
        className={css({
          display: 'flex',
          gap: '1.5',
          justifyContent: 'center',
          alignItems: 'center',
          p: '4',
          bg: 'rgba(0, 0, 0, 0.3)',
          rounded: 'lg',
          minH: '32',
        })}
      >
        {Array.from({ length: displayDigits }).map((_, i) => (
          <AbacusColumn key={i} color={color} />
        ))}
        {showEllipsis && (
          <div className={css({ color: 'gray.500', fontSize: '2xl', px: '2' })}>...</div>
        )}
      </div>

      {/* Digit count label */}
      <div className={css({ textAlign: 'center', mt: '3', fontSize: 'sm', color: 'gray.400' })}>
        {digits} {digits === 1 ? 'digit' : 'digits'}
      </div>
    </div>
  )
}

export default function LevelsPage() {
  return (
    <PageWithNav navTitle="Kyu & Dan Levels" navEmoji="📊">
      <div className={css({ bg: 'gray.900', minHeight: '100vh' })}>
        {/* Hero Section */}
        <div
          className={css({
            background:
              'linear-gradient(135deg, rgba(17, 24, 39, 1) 0%, rgba(124, 58, 237, 0.3) 50%, rgba(17, 24, 39, 1) 100%)',
            color: 'white',
            py: { base: '12', md: '16' },
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
                  mb: '4',
                  lineHeight: 'tight',
                  background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #fbbf24 100%)',
                  backgroundClip: 'text',
                  color: 'transparent',
                })}
              >
                Understanding Kyu & Dan Levels
              </h1>

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
                Explore the progression from beginner to master
              </p>
            </div>
          </div>
        </div>

        {/* Main content container */}
        <div className={container({ maxW: '7xl', px: '4', py: '12' })}>
          {/* Journey Slider */}
          <section className={stack({ gap: '8' })}>
            <div className={css({ textAlign: 'center' })}>
              <h2
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: 'bold',
                  color: 'white',
                  mb: '4',
                })}
              >
                The Complete Journey
              </h2>
              <p className={css({ color: 'gray.400', fontSize: 'md', mb: '8' })}>
                Slide through all ranks from 10th Kyu to 10th Dan
              </p>
            </div>

            {/* Horizontal Slider */}
            <div
              className={css({
                w: '100%',
                overflowX: 'auto',
                overflowY: 'hidden',
                pb: '4',
              })}
            >
              <div className={css({ display: 'flex', gap: '4', pb: '2' })}>
                {/* Kyu Levels */}
                {kyuLevels.map((kyu, index) => (
                  <LevelCard
                    key={index}
                    level={kyu.level}
                    emoji={kyu.emoji}
                    color={kyu.color}
                    digits={kyu.digits}
                  />
                ))}

                {/* Transition marker */}
                <div
                  className={css({
                    minW: '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '4xl',
                    color: 'gray.500',
                  })}
                >
                  →
                </div>

                {/* Dan Levels */}
                {danLevels.map((dan, index) => (
                  <LevelCard
                    key={index}
                    level={dan.level}
                    emoji={dan.emoji}
                    color="amber"
                    digits={dan.digits}
                    subtitle={`${dan.minScore}+ pts`}
                  />
                ))}
              </div>
            </div>

            {/* Legend */}
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6',
                justifyContent: 'center',
                mt: '6',
                p: '6',
                bg: 'rgba(0, 0, 0, 0.3)',
                rounded: 'lg',
              })}
            >
              <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                <div className={css({ w: '4', h: '4', bg: 'green.500', rounded: 'sm' })} />
                <span className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  Beginner (10-7 Kyu)
                </span>
              </div>
              <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                <div className={css({ w: '4', h: '4', bg: 'blue.500', rounded: 'sm' })} />
                <span className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  Intermediate (6-4 Kyu)
                </span>
              </div>
              <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                <div className={css({ w: '4', h: '4', bg: 'violet.500', rounded: 'sm' })} />
                <span className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  Advanced (3-1 Kyu)
                </span>
              </div>
              <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
                <div className={css({ w: '4', h: '4', bg: 'amber.500', rounded: 'sm' })} />
                <span className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  Master (Dan ranks)
                </span>
              </div>
            </div>
          </section>

          {/* Additional Information Section */}
          <section className={stack({ gap: '8', mt: '16', pb: '12' })}>
            <div
              className={css({
                bg: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid',
                borderColor: 'gray.700',
                rounded: 'xl',
                p: { base: '6', md: '8' },
              })}
            >
              <h3
                className={css({
                  fontSize: { base: 'xl', md: '2xl' },
                  fontWeight: 'bold',
                  color: 'white',
                  mb: '4',
                })}
              >
                About This Ranking System
              </h3>
              <div className={stack({ gap: '4' })}>
                <p className={css({ color: 'gray.300', lineHeight: '1.6' })}>
                  This ranking system is based on the official examination structure used by the{' '}
                  <strong className={css({ color: 'white' })}>Japan Abacus Federation</strong>. It
                  represents a standardized progression from beginner (10th Kyu) to master level
                  (10th Dan), used internationally for soroban proficiency assessment.
                </p>
                <p className={css({ color: 'gray.300', lineHeight: '1.6' })}>
                  The system is designed to gradually increase in difficulty. Kyu levels progress
                  from 2-digit calculations at 10th Kyu to 10-digit calculations at 1st Kyu. Dan
                  levels all require mastery of 30-digit calculations, with ranks awarded based on
                  exam scores.
                </p>
                <div
                  className={css({
                    mt: '4',
                    pt: '4',
                    borderTop: '1px solid',
                    borderColor: 'gray.700',
                    fontSize: 'sm',
                    color: 'gray.400',
                    fontStyle: 'italic',
                  })}
                >
                  Note: This page provides information about the official Japanese ranking system
                  for educational purposes. This application does not administer official
                  examinations or certifications.
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageWithNav>
  )
}
