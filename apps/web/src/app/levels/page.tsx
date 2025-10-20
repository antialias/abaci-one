'use client'

import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'
import { container, grid, stack } from '../../../styled-system/patterns'

// Kyu level data from the Japan Abacus Federation
const kyuLevels = [
  {
    level: '10th Kyu',
    emoji: '🧒',
    color: 'green',
    duration: '20 min',
    passThreshold: '30%',
    points: '60/200',
    sections: [
      { name: 'Addition', digits: '2-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '2-digit', problems: 10, points: 10 },
    ],
    notes: 'No division at this level',
  },
  {
    level: '9th Kyu',
    emoji: '🧒',
    color: 'green',
    duration: '20 min',
    passThreshold: '60%',
    points: '120/200',
    sections: [
      { name: 'Addition', digits: '2-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '2-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '1×1', problems: 10, points: 10 },
    ],
    notes: 'Introduces multiplication',
  },
  {
    level: '8th Kyu',
    emoji: '🧒',
    color: 'green',
    duration: '20 min',
    passThreshold: '60%',
    points: '120/200',
    sections: [
      { name: 'Addition', digits: '3-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '3-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '2×1', problems: 10, points: 10 },
      { name: 'Division', digits: '2÷1', problems: 10, points: 10 },
    ],
    notes: 'Introduces division',
  },
  {
    level: '7th Kyu',
    emoji: '🧒',
    color: 'green',
    duration: '20 min',
    passThreshold: '60%',
    points: '120/200',
    sections: [
      { name: 'Addition', digits: '4-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '4-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '3×1', problems: 10, points: 10 },
      { name: 'Division', digits: '3÷1', problems: 10, points: 10 },
    ],
    notes: 'All four operations',
  },
  {
    level: '6th Kyu',
    emoji: '🧑',
    color: 'blue',
    duration: '30 min',
    passThreshold: '70%',
    points: '210/300',
    sections: [
      { name: 'Addition', digits: '5-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '5-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '4×2', problems: 10, points: 10 },
      { name: 'Division', digits: '5÷2', problems: 10, points: 10 },
    ],
    notes: 'Longer exam time',
  },
  {
    level: '5th Kyu',
    emoji: '🧑',
    color: 'blue',
    duration: '30 min',
    passThreshold: '70%',
    points: '210/300',
    sections: [
      { name: 'Addition', digits: '6-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '6-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '5×2', problems: 10, points: 10 },
      { name: 'Division', digits: '6÷2', problems: 10, points: 10 },
    ],
    notes: 'Mid-level proficiency',
  },
  {
    level: '4th Kyu',
    emoji: '🧑',
    color: 'blue',
    duration: '30 min',
    passThreshold: '70%',
    points: '210/300',
    sections: [
      { name: 'Addition', digits: '7-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '7-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '6×2', problems: 10, points: 10 },
      { name: 'Division', digits: '7÷2', problems: 10, points: 10 },
    ],
    notes: 'Advanced intermediate',
  },
  {
    level: '3rd Kyu',
    emoji: '🧔',
    color: 'violet',
    duration: '30 min',
    passThreshold: '80%',
    points: '240/300',
    sections: [
      { name: 'Addition', digits: '8-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '8-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '7×2', problems: 10, points: 10 },
      { name: 'Division', digits: '8÷2', problems: 10, points: 10 },
    ],
    notes: 'Higher pass threshold (80%)',
  },
  {
    level: '2nd Kyu',
    emoji: '🧔',
    color: 'violet',
    duration: '30 min',
    passThreshold: '80%',
    points: '240/300',
    sections: [
      { name: 'Addition', digits: '9-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '9-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '8×2', problems: 10, points: 10 },
      { name: 'Division', digits: '9÷2', problems: 10, points: 10 },
    ],
    notes: 'Near-mastery level',
  },
  {
    level: '1st Kyu',
    emoji: '🧔',
    color: 'violet',
    duration: '30 min',
    passThreshold: '80%',
    points: '240/300',
    sections: [
      { name: 'Addition', digits: '10-digit', problems: 10, points: 10 },
      { name: 'Subtraction', digits: '10-digit', problems: 10, points: 10 },
      { name: 'Multiplication', digits: '9×2', problems: 10, points: 10 },
      { name: 'Division', digits: '10÷2', problems: 10, points: 10 },
    ],
    notes: 'Highest Kyu level before Dan',
  },
] as const

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
                Understanding Kyu & Dan Levels
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
                Learn about the official Japanese soroban ranking system used by the Japan Abacus
                Federation
              </p>

              {/* Journey progression emojis */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: '4',
                  mb: '8',
                  flexWrap: 'wrap',
                })}
              >
                {[
                  { emoji: '🧒', label: '10 Kyu' },
                  { emoji: '→', label: '', isArrow: true },
                  { emoji: '🧑', label: '5 Kyu' },
                  { emoji: '→', label: '', isArrow: true },
                  { emoji: '🧔', label: '1 Kyu' },
                  { emoji: '→', label: '', isArrow: true },
                  { emoji: '🧙', label: 'Dan' },
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
                        fontSize: step.isArrow ? 'xl' : '4xl',
                        color: step.isArrow ? 'gray.500' : 'yellow.400',
                      })}
                    >
                      {step.emoji}
                    </div>
                    {step.label && (
                      <div className={css({ fontSize: 'xs', color: 'gray.400' })}>{step.label}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main content container */}
        <div className={container({ maxW: '7xl', px: '4', py: '12' })}>
          {/* Kyu Levels Section */}
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
                Kyu Levels (10th to 1st)
              </h2>
              <p className={css({ color: 'gray.400', fontSize: 'md', mb: '8' })}>
                Progress from beginner to advanced mastery
              </p>
            </div>

            {/* Kyu Level Cards */}
            <div className={grid({ columns: { base: 1, md: 2, lg: 3 }, gap: '6' })}>
              {kyuLevels.map((kyu, index) => (
                <div
                  key={index}
                  className={css({
                    bg: 'rgba(0, 0, 0, 0.4)',
                    border: '1px solid',
                    borderColor:
                      kyu.color === 'green'
                        ? 'green.700'
                        : kyu.color === 'blue'
                          ? 'blue.700'
                          : 'violet.700',
                    rounded: 'xl',
                    p: '6',
                    transition: 'all 0.2s',
                    _hover: {
                      bg: 'rgba(0, 0, 0, 0.5)',
                      borderColor:
                        kyu.color === 'green'
                          ? 'green.500'
                          : kyu.color === 'blue'
                            ? 'blue.500'
                            : 'violet.500',
                      transform: 'translateY(-2px)',
                    },
                  })}
                >
                  {/* Card Header */}
                  <div
                    className={css({ display: 'flex', alignItems: 'center', gap: '3', mb: '4' })}
                  >
                    <div className={css({ fontSize: '3xl' })}>{kyu.emoji}</div>
                    <div>
                      <h3
                        className={css({
                          fontSize: 'xl',
                          fontWeight: 'bold',
                          color:
                            kyu.color === 'green'
                              ? 'green.400'
                              : kyu.color === 'blue'
                                ? 'blue.400'
                                : 'violet.400',
                        })}
                      >
                        {kyu.level}
                      </h3>
                      <p className={css({ fontSize: 'sm', color: 'gray.400' })}>{kyu.notes}</p>
                    </div>
                  </div>

                  {/* Exam Details */}
                  <div className={stack({ gap: '3' })}>
                    <div
                      className={css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 'sm',
                      })}
                    >
                      <span className={css({ color: 'gray.400' })}>Duration:</span>
                      <span className={css({ color: 'white', fontWeight: '500' })}>
                        {kyu.duration}
                      </span>
                    </div>
                    <div
                      className={css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 'sm',
                      })}
                    >
                      <span className={css({ color: 'gray.400' })}>Pass Threshold:</span>
                      <span className={css({ color: 'amber.400', fontWeight: '600' })}>
                        {kyu.passThreshold}
                      </span>
                    </div>
                    <div
                      className={css({
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 'sm',
                      })}
                    >
                      <span className={css({ color: 'gray.400' })}>Points Needed:</span>
                      <span className={css({ color: 'white', fontWeight: '500' })}>
                        {kyu.points}
                      </span>
                    </div>
                  </div>

                  {/* Sections */}
                  <div
                    className={css({
                      mt: '4',
                      pt: '4',
                      borderTop: '1px solid',
                      borderColor: 'gray.700',
                    })}
                  >
                    <div
                      className={css({
                        fontSize: 'xs',
                        color: 'gray.500',
                        mb: '2',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      })}
                    >
                      Problem Types
                    </div>
                    {kyu.sections.map((section, i) => (
                      <div
                        key={i}
                        className={css({
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 'sm',
                          py: '1',
                        })}
                      >
                        <span className={css({ color: 'gray.300' })}>{section.name}</span>
                        <span className={css({ color: 'gray.400', fontSize: 'xs' })}>
                          {section.digits}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </PageWithNav>
  )
}
