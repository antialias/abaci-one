'use client'

import { useState, useEffect } from 'react'
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

// Dan level data - score-based ranking system
const danLevels = [
  { level: 'Pre-1st Dan', name: 'Jun-Shodan', minScore: 90, emoji: '🧙' },
  { level: '1st Dan', name: 'Shodan', minScore: 100, emoji: '🧙' },
  { level: '2nd Dan', name: 'Nidan', minScore: 120, emoji: '🧙‍♂️' },
  { level: '3rd Dan', name: 'Sandan', minScore: 140, emoji: '🧙‍♂️' },
  { level: '4th Dan', name: 'Yondan', minScore: 160, emoji: '🧙‍♀️' },
  { level: '5th Dan', name: 'Godan', minScore: 180, emoji: '🧙‍♀️' },
  { level: '6th Dan', name: 'Rokudan', minScore: 200, emoji: '🧝' },
  { level: '7th Dan', name: 'Nanadan', minScore: 220, emoji: '🧝' },
  { level: '8th Dan', name: 'Hachidan', minScore: 250, emoji: '🧝‍♂️' },
  { level: '9th Dan', name: 'Kudan', minScore: 270, emoji: '🧝‍♀️' },
  { level: '10th Dan', name: 'Judan', minScore: 290, emoji: '👑' },
] as const

// Helper function to extract digit count from a kyu level
function getDigitCount(kyu: (typeof kyuLevels)[number]): number {
  const additionSection = kyu.sections.find((s) => s.name === 'Addition')
  if (!additionSection) return 0
  const match = additionSection.digits.match(/(\d+)-digit/)
  return match ? Number.parseInt(match[1], 10) : 0
}

// Abacus visualization component
function AbacusVisualization({ digitCount, color }: { digitCount: number; color: string }) {
  // Show limited columns on mobile
  const displayCount = digitCount

  return (
    <div
      className={css({ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3' })}
    >
      <div
        className={css({
          fontSize: 'sm',
          color: 'gray.400',
          textAlign: 'center',
        })}
      >
        Master {digitCount}-digit calculations
      </div>
      <div
        className={css({
          display: 'flex',
          gap: '2',
          justifyContent: 'center',
          flexWrap: 'wrap',
          maxW: '100%',
        })}
      >
        {Array.from({ length: displayCount }).map((_, i) => (
          <div
            key={i}
            className={css({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '1',
            })}
          >
            {/* Top bead (heaven) */}
            <div
              className={css({
                w: '3',
                h: '3',
                rounded: 'full',
                bg: color === 'green' ? 'green.500' : color === 'blue' ? 'blue.500' : 'violet.500',
                opacity: 0.6,
              })}
            />
            {/* Divider bar */}
            <div
              className={css({
                w: '4',
                h: '0.5',
                bg: 'gray.600',
              })}
            />
            {/* Bottom beads (earth) - 4 beads */}
            <div className={css({ display: 'flex', flexDirection: 'column', gap: '1' })}>
              {Array.from({ length: 4 }).map((_, j) => (
                <div
                  key={j}
                  className={css({
                    w: '3',
                    h: '3',
                    rounded: 'full',
                    bg:
                      color === 'green'
                        ? 'green.500'
                        : color === 'blue'
                          ? 'blue.500'
                          : 'violet.500',
                    opacity: 0.6,
                  })}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LevelsPage() {
  const [currentKyuIndex, setCurrentKyuIndex] = useState(0)
  const currentKyu = kyuLevels[currentKyuIndex]
  const digitCount = getDigitCount(currentKyu)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setCurrentKyuIndex((prev) => (prev > 0 ? prev - 1 : kyuLevels.length - 1))
      } else if (e.key === 'ArrowRight') {
        setCurrentKyuIndex((prev) => (prev < kyuLevels.length - 1 ? prev + 1 : 0))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handlePrevious = () => {
    setCurrentKyuIndex((prev) => (prev > 0 ? prev - 1 : kyuLevels.length - 1))
  }

  const handleNext = () => {
    setCurrentKyuIndex((prev) => (prev < kyuLevels.length - 1 ? prev + 1 : 0))
  }

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
              <p className={css({ color: 'gray.400', fontSize: 'md', mb: '4' })}>
                Explore the progression from beginner to advanced mastery
              </p>
              <p className={css({ color: 'gray.500', fontSize: 'sm', mb: '8' })}>
                Use arrow keys or click the buttons to navigate
              </p>
            </div>

            {/* Slider Container */}
            <div className={css({ position: 'relative', maxW: '4xl', mx: 'auto', w: '100%' })}>
              {/* Navigation Buttons */}
              <button
                type="button"
                onClick={handlePrevious}
                className={css({
                  position: 'absolute',
                  left: { base: '-4', md: '-16' },
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  bg: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid',
                  borderColor: 'gray.600',
                  rounded: 'full',
                  w: { base: '10', md: '12' },
                  h: { base: '10', md: '12' },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    bg: 'rgba(0, 0, 0, 0.8)',
                    borderColor: 'gray.400',
                    transform: 'translateY(-50%) scale(1.1)',
                  },
                })}
              >
                <span className={css({ fontSize: { base: 'xl', md: '2xl' }, color: 'white' })}>
                  ‹
                </span>
              </button>

              <button
                type="button"
                onClick={handleNext}
                className={css({
                  position: 'absolute',
                  right: { base: '-4', md: '-16' },
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 10,
                  bg: 'rgba(0, 0, 0, 0.6)',
                  border: '1px solid',
                  borderColor: 'gray.600',
                  rounded: 'full',
                  w: { base: '10', md: '12' },
                  h: { base: '10', md: '12' },
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  _hover: {
                    bg: 'rgba(0, 0, 0, 0.8)',
                    borderColor: 'gray.400',
                    transform: 'translateY(-50%) scale(1.1)',
                  },
                })}
              >
                <span className={css({ fontSize: { base: 'xl', md: '2xl' }, color: 'white' })}>
                  ›
                </span>
              </button>

              {/* Current Level Card */}
              <div
                className={css({
                  bg: 'rgba(0, 0, 0, 0.4)',
                  border: '2px solid',
                  borderColor:
                    currentKyu.color === 'green'
                      ? 'green.500'
                      : currentKyu.color === 'blue'
                        ? 'blue.500'
                        : 'violet.500',
                  rounded: 'xl',
                  p: { base: '6', md: '8' },
                  transition: 'all 0.3s ease',
                })}
              >
                {/* Card Header */}
                <div className={css({ display: 'flex', alignItems: 'center', gap: '4', mb: '6' })}>
                  <div className={css({ fontSize: { base: '4xl', md: '5xl' } })}>
                    {currentKyu.emoji}
                  </div>
                  <div className={css({ flex: '1' })}>
                    <h3
                      className={css({
                        fontSize: { base: '2xl', md: '3xl' },
                        fontWeight: 'bold',
                        color:
                          currentKyu.color === 'green'
                            ? 'green.400'
                            : currentKyu.color === 'blue'
                              ? 'blue.400'
                              : 'violet.400',
                        mb: '1',
                      })}
                    >
                      {currentKyu.level}
                    </h3>
                    <p className={css({ fontSize: 'md', color: 'gray.400' })}>{currentKyu.notes}</p>
                  </div>
                </div>

                {/* Abacus Visualization */}
                <div
                  className={css({
                    mb: '6',
                    p: { base: '4', md: '6' },
                    bg: 'rgba(0, 0, 0, 0.3)',
                    rounded: 'lg',
                    border: '1px solid',
                    borderColor: 'gray.700',
                  })}
                >
                  <AbacusVisualization digitCount={digitCount} color={currentKyu.color} />
                </div>

                {/* Exam Details */}
                <div className={grid({ columns: { base: 1, md: 3 }, gap: '4', mb: '6' })}>
                  <div
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2',
                      p: '4',
                      bg: 'rgba(0, 0, 0, 0.3)',
                      rounded: 'lg',
                    })}
                  >
                    <span className={css({ fontSize: 'sm', color: 'gray.400' })}>Duration</span>
                    <span
                      className={css({
                        fontSize: { base: 'lg', md: 'xl' },
                        color: 'white',
                        fontWeight: '600',
                      })}
                    >
                      {currentKyu.duration}
                    </span>
                  </div>
                  <div
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2',
                      p: '4',
                      bg: 'rgba(0, 0, 0, 0.3)',
                      rounded: 'lg',
                    })}
                  >
                    <span className={css({ fontSize: 'sm', color: 'gray.400' })}>
                      Pass Threshold
                    </span>
                    <span
                      className={css({
                        fontSize: { base: 'lg', md: 'xl' },
                        color: 'amber.400',
                        fontWeight: '700',
                      })}
                    >
                      {currentKyu.passThreshold}
                    </span>
                  </div>
                  <div
                    className={css({
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2',
                      p: '4',
                      bg: 'rgba(0, 0, 0, 0.3)',
                      rounded: 'lg',
                    })}
                  >
                    <span className={css({ fontSize: 'sm', color: 'gray.400' })}>
                      Points Needed
                    </span>
                    <span
                      className={css({
                        fontSize: { base: 'lg', md: 'xl' },
                        color: 'white',
                        fontWeight: '600',
                      })}
                    >
                      {currentKyu.points}
                    </span>
                  </div>
                </div>

                {/* Problem Types */}
                <div
                  className={css({
                    pt: '6',
                    borderTop: '1px solid',
                    borderColor: 'gray.700',
                  })}
                >
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: 'gray.500',
                      mb: '4',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      textAlign: 'center',
                    })}
                  >
                    Problem Types
                  </div>
                  <div className={grid({ columns: { base: 1, md: 2 }, gap: '3' })}>
                    {currentKyu.sections.map((section, i) => (
                      <div
                        key={i}
                        className={css({
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontSize: 'sm',
                          p: '3',
                          bg: 'rgba(0, 0, 0, 0.2)',
                          rounded: 'md',
                        })}
                      >
                        <span className={css({ color: 'gray.300', fontWeight: '500' })}>
                          {section.name}
                        </span>
                        <span className={css({ color: 'gray.400', fontSize: 'xs' })}>
                          {section.digits}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Progress Indicators */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'center',
                  gap: '2',
                  mt: '6',
                })}
              >
                {kyuLevels.map((_, index) => (
                  <button
                    type="button"
                    key={index}
                    onClick={() => setCurrentKyuIndex(index)}
                    className={css({
                      w: currentKyuIndex === index ? '8' : '2',
                      h: '2',
                      rounded: 'full',
                      bg:
                        currentKyuIndex === index
                          ? currentKyu.color === 'green'
                            ? 'green.500'
                            : currentKyu.color === 'blue'
                              ? 'blue.500'
                              : 'violet.500'
                          : 'gray.600',
                      transition: 'all 0.3s',
                      cursor: 'pointer',
                      _hover: {
                        bg:
                          currentKyuIndex === index
                            ? currentKyu.color === 'green'
                              ? 'green.400'
                              : currentKyu.color === 'blue'
                                ? 'blue.400'
                                : 'violet.400'
                            : 'gray.500',
                      },
                    })}
                    aria-label={`Go to ${kyuLevels[index].level}`}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* Dan Levels Section */}
          <section className={stack({ gap: '8', mt: '16' })}>
            <div className={css({ textAlign: 'center' })}>
              <h2
                className={css({
                  fontSize: { base: '2xl', md: '3xl' },
                  fontWeight: 'bold',
                  color: 'white',
                  mb: '4',
                })}
              >
                Dan Levels (Master Ranks)
              </h2>
              <p className={css({ color: 'gray.400', fontSize: 'md', mb: '8' })}>
                Score-based ranking system for master-level practitioners
              </p>
            </div>

            {/* Exam Requirements Box */}
            <div
              className={css({
                bg: 'rgba(251, 191, 36, 0.1)',
                border: '1px solid',
                borderColor: 'amber.700',
                rounded: 'xl',
                p: '6',
                mb: '6',
              })}
            >
              <h3
                className={css({
                  fontSize: 'lg',
                  fontWeight: 'bold',
                  color: 'amber.400',
                  mb: '3',
                })}
              >
                Dan Exam Requirements
              </h3>
              <div className={stack({ gap: '2' })}>
                <div className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  <strong>Duration:</strong> 30 minutes
                </div>
                <div className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  <strong>Problem Complexity:</strong> 3× that of 1st Kyu
                </div>
                <div className={css({ fontSize: 'sm', color: 'gray.300', mt: '2' })}>
                  • Addition/Subtraction: 30-digit numbers
                </div>
                <div className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  • Multiplication: 27×6 digits
                </div>
                <div className={css({ fontSize: 'sm', color: 'gray.300' })}>
                  • Division: 30÷6 digits
                </div>
              </div>
            </div>

            {/* Dan Ladder Visualization */}
            <div
              className={css({
                bg: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid',
                borderColor: 'amber.700',
                rounded: 'xl',
                p: { base: '6', md: '8' },
                position: 'relative',
              })}
            >
              <div className={stack({ gap: '0' })}>
                {danLevels
                  .slice()
                  .reverse()
                  .map((dan, index) => {
                    const isTop = index === 0
                    return (
                      <div
                        key={index}
                        className={css({
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4',
                          p: '3',
                          borderBottom: !isTop ? '1px solid' : 'none',
                          borderColor: 'gray.700',
                          transition: 'all 0.2s',
                          _hover: {
                            bg: isTop ? 'rgba(251, 191, 36, 0.1)' : 'rgba(251, 191, 36, 0.05)',
                          },
                        })}
                      >
                        {/* Emoji */}
                        <div
                          className={css({
                            fontSize: '3xl',
                            minW: '12',
                            textAlign: 'center',
                          })}
                        >
                          {dan.emoji}
                        </div>

                        {/* Level Info */}
                        <div className={css({ flex: '1' })}>
                          <div
                            className={css({
                              fontSize: 'lg',
                              fontWeight: 'bold',
                              color: isTop ? 'amber.300' : 'amber.400',
                            })}
                          >
                            {dan.level}
                          </div>
                          <div className={css({ fontSize: 'sm', color: 'gray.400' })}>
                            {dan.name}
                          </div>
                        </div>

                        {/* Score */}
                        <div
                          className={css({
                            fontSize: { base: 'xl', md: '2xl' },
                            fontWeight: 'bold',
                            color: isTop ? 'amber.300' : 'white',
                            minW: { base: '20', md: '24' },
                            textAlign: 'right',
                          })}
                        >
                          {dan.minScore}
                          <span className={css({ fontSize: 'sm', color: 'gray.400', ml: '1' })}>
                            pts
                          </span>
                        </div>
                      </div>
                    )
                  })}
              </div>

              {/* Legend */}
              <div
                className={css({
                  mt: '6',
                  pt: '6',
                  borderTop: '1px solid',
                  borderColor: 'gray.700',
                  fontSize: 'sm',
                  color: 'gray.400',
                  textAlign: 'center',
                })}
              >
                Ranks are awarded based on total score achieved on the Dan-level exam
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
                  The system is designed to gradually increase in difficulty, ensuring students
                  build a solid foundation before advancing. Each level requires mastery of
                  increasingly complex calculations, from simple 2-digit operations at 10th Kyu to
                  30-digit calculations at Dan level.
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
