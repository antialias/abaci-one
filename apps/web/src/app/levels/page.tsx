'use client'

import { useState } from 'react'
import { useSpring, animated } from '@react-spring/web'
import * as Slider from '@radix-ui/react-slider'
import { AbacusReact } from '@soroban/abacus-react'
import { PageWithNav } from '@/components/PageWithNav'
import { css } from '../../../styled-system/css'
import { container, stack } from '../../../styled-system/patterns'

// Combine all levels into one array for the slider
const allLevels = [
  { level: '10th Kyu', emoji: '🧒', color: 'green', digits: 2, type: 'kyu' as const },
  { level: '9th Kyu', emoji: '🧒', color: 'green', digits: 2, type: 'kyu' as const },
  { level: '8th Kyu', emoji: '🧒', color: 'green', digits: 3, type: 'kyu' as const },
  { level: '7th Kyu', emoji: '🧒', color: 'green', digits: 4, type: 'kyu' as const },
  { level: '6th Kyu', emoji: '🧑', color: 'blue', digits: 5, type: 'kyu' as const },
  { level: '5th Kyu', emoji: '🧑', color: 'blue', digits: 6, type: 'kyu' as const },
  { level: '4th Kyu', emoji: '🧑', color: 'blue', digits: 7, type: 'kyu' as const },
  { level: '3rd Kyu', emoji: '🧔', color: 'violet', digits: 8, type: 'kyu' as const },
  { level: '2nd Kyu', emoji: '🧔', color: 'violet', digits: 9, type: 'kyu' as const },
  { level: '1st Kyu', emoji: '🧔', color: 'violet', digits: 10, type: 'kyu' as const },
  {
    level: 'Pre-1st Dan',
    name: 'Jun-Shodan',
    minScore: 90,
    emoji: '🧙',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '1st Dan',
    name: 'Shodan',
    minScore: 100,
    emoji: '🧙',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '2nd Dan',
    name: 'Nidan',
    minScore: 120,
    emoji: '🧙‍♂️',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '3rd Dan',
    name: 'Sandan',
    minScore: 140,
    emoji: '🧙‍♂️',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '4th Dan',
    name: 'Yondan',
    minScore: 160,
    emoji: '🧙‍♀️',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '5th Dan',
    name: 'Godan',
    minScore: 180,
    emoji: '🧙‍♀️',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '6th Dan',
    name: 'Rokudan',
    minScore: 200,
    emoji: '🧝',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '7th Dan',
    name: 'Nanadan',
    minScore: 220,
    emoji: '🧝',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '8th Dan',
    name: 'Hachidan',
    minScore: 250,
    emoji: '🧝‍♂️',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '9th Dan',
    name: 'Kudan',
    minScore: 270,
    emoji: '🧝‍♀️',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
  {
    level: '10th Dan',
    name: 'Judan',
    minScore: 290,
    emoji: '👑',
    color: 'amber',
    digits: 30,
    type: 'dan' as const,
  },
] as const

export default function LevelsPage() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const currentLevel = allLevels[currentIndex]

  // Calculate scale factor based on number of columns to fit the page
  // Use constrained range to prevent huge size differences between levels
  // Min 1.2 (for 30-column Dan levels) to Max 2.0 (for 2-column Kyu levels)
  const scaleFactor = Math.max(1.2, Math.min(2.0, 20 / currentLevel.digits))

  // Animate scale factor with React Spring for smooth transitions
  const animatedProps = useSpring({
    scaleFactor,
    config: { tension: 280, friction: 60 },
  })

  // Generate an interesting non-zero number to display on the abacus
  // Use a suffix pattern so rightmost digits stay constant as columns increase
  // This prevents beads from shifting: ones always 9, tens always 8, etc.
  const digitPattern = '123456789'
  // Use BigInt for numbers > 15 digits (Dan levels with 30 columns)
  const repeatedPattern = digitPattern.repeat(Math.ceil(currentLevel.digits / digitPattern.length))
  const digitString = repeatedPattern.slice(-currentLevel.digits)

  // Use BigInt for large numbers to get full 30-digit precision
  const displayValue =
    currentLevel.digits > 15 ? BigInt(digitString) : Number.parseInt(digitString, 10)

  // Dark theme styles matching the homepage
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
    <PageWithNav navTitle="Kyu & Dan Levels" navEmoji="📊">
      <div className={css({ bg: 'gray.900', minHeight: '100vh', pb: '12' })}>
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
                Slide through the complete progression from beginner to master
              </p>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className={container({ maxW: '6xl', px: '4', py: '12' })}>
          <section className={stack({ gap: '8' })}>
            {/* Current Level Display */}
            <div
              className={css({
                bg: 'rgba(0, 0, 0, 0.4)',
                border: '2px solid',
                borderColor:
                  currentLevel.color === 'green'
                    ? 'green.500'
                    : currentLevel.color === 'blue'
                      ? 'blue.500'
                      : currentLevel.color === 'violet'
                        ? 'violet.500'
                        : 'amber.500',
                rounded: 'xl',
                p: { base: '6', md: '8' },
                height: { base: 'auto', md: '700px' },
                display: 'flex',
                flexDirection: 'column',
              })}
            >
              {/* Level Info */}
              <div
                className={css({
                  textAlign: 'center',
                  mb: '4',
                  height: '160px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                })}
              >
                <div className={css({ fontSize: '5xl', mb: '3' })}>{currentLevel.emoji}</div>
                <h2
                  className={css({
                    fontSize: { base: '2xl', md: '3xl' },
                    fontWeight: 'bold',
                    color:
                      currentLevel.color === 'green'
                        ? 'green.400'
                        : currentLevel.color === 'blue'
                          ? 'blue.400'
                          : currentLevel.color === 'violet'
                            ? 'violet.400'
                            : 'amber.400',
                    mb: '2',
                  })}
                >
                  {currentLevel.level}
                </h2>
                {'name' in currentLevel && (
                  <div className={css({ fontSize: 'md', color: 'gray.400', mb: '1' })}>
                    {currentLevel.name}
                  </div>
                )}
                {'minScore' in currentLevel && (
                  <div className={css({ fontSize: 'sm', color: 'gray.500' })}>
                    Minimum Score: {currentLevel.minScore} points
                  </div>
                )}
              </div>

              {/* Abacus-themed Radix Slider */}
              <div className={css({ mb: '6', px: { base: '2', md: '8' } })}>
                <div className={css({ mb: '3', textAlign: 'center' })}>
                  <p className={css({ fontSize: 'sm', color: 'gray.400' })}>
                    Drag or click the beads to explore all levels
                  </p>
                </div>

                <div className={css({ position: 'relative', py: '6' })}>
                  <Slider.Root
                    value={[currentIndex]}
                    onValueChange={([value]) => setCurrentIndex(value)}
                    min={0}
                    max={allLevels.length - 1}
                    step={1}
                    className={css({
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      userSelect: 'none',
                      touchAction: 'none',
                      w: 'full',
                      h: '12',
                      cursor: 'pointer',
                    })}
                  >
                    {/* Decorative beads for all levels */}
                    {allLevels.map((level, index) => {
                      const isActive = index === currentIndex
                      const isDan = 'color' in level && level.color === 'violet'
                      const beadColor = isActive
                        ? isDan
                          ? 'violet.400'
                          : 'green.400'
                        : isDan
                          ? 'rgba(139, 92, 246, 0.4)'
                          : 'rgba(34, 197, 94, 0.4)'

                      return (
                        <div
                          key={index}
                          className={css({
                            position: 'absolute',
                            top: '50%',
                            left: `${(index / (allLevels.length - 1)) * 100}%`,
                            transform: 'translate(-50%, -50%)',
                            w: isActive ? '16px' : '10px',
                            h: isActive ? '16px' : '10px',
                            bg: beadColor,
                            rounded: 'full',
                            border: '2px solid',
                            borderColor: isActive
                              ? isDan
                                ? 'violet.200'
                                : 'green.200'
                              : 'rgba(255, 255, 255, 0.3)',
                            transition: 'all 0.2s',
                            boxShadow: isActive
                              ? `0 0 12px ${isDan ? 'rgba(139, 92, 246, 0.6)' : 'rgba(34, 197, 94, 0.6)'}`
                              : 'none',
                            pointerEvents: 'none',
                            zIndex: 0,
                          })}
                        />
                      )
                    })}

                    <Slider.Track
                      className={css({
                        bg: 'rgba(255, 255, 255, 0.2)',
                        position: 'relative',
                        flexGrow: 1,
                        rounded: 'full',
                        h: '3px',
                      })}
                    >
                      <Slider.Range className={css({ display: 'none' })} />
                    </Slider.Track>

                    <Slider.Thumb
                      className={css({
                        display: 'block',
                        w: '20px',
                        h: '20px',
                        bg: currentLevel.color === 'violet' ? 'violet.500' : 'green.500',
                        shadow: '0 0 16px rgba(0, 0, 0, 0.4)',
                        rounded: 'full',
                        border: '3px solid',
                        borderColor: currentLevel.color === 'violet' ? 'violet.200' : 'green.200',
                        cursor: 'grab',
                        transition: 'all 0.2s',
                        zIndex: 10,
                        _hover: { transform: 'scale(1.15)' },
                        _focus: {
                          outline: 'none',
                          transform: 'scale(1.15)',
                          boxShadow: `0 0 20px ${currentLevel.color === 'violet' ? 'rgba(139, 92, 246, 0.8)' : 'rgba(34, 197, 94, 0.8)'}`,
                        },
                        _active: { cursor: 'grabbing' },
                      })}
                    />
                  </Slider.Root>
                </div>

                {/* Level Markers */}
                <div
                  className={css({
                    display: 'flex',
                    justifyContent: 'space-between',
                    mt: '1',
                    fontSize: 'xs',
                    color: 'gray.500',
                  })}
                >
                  <span>10th Kyu</span>
                  <span>1st Kyu</span>
                  <span>10th Dan</span>
                </div>
              </div>

              {/* Abacus Display */}
              <div
                className={css({
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  p: '6',
                  bg: 'rgba(0, 0, 0, 0.3)',
                  rounded: 'lg',
                  border: '1px solid',
                  borderColor: 'gray.700',
                  overflow: 'hidden',
                  flex: 1,
                })}
              >
                <animated.div
                  style={{
                    transform: animatedProps.scaleFactor.to((s) => `scale(${s / scaleFactor})`),
                  }}
                >
                  <AbacusReact
                    value={displayValue}
                    columns={currentLevel.digits}
                    scaleFactor={scaleFactor}
                    showNumbers={true}
                    customStyles={darkStyles}
                  />
                </animated.div>
              </div>

              {/* Digit Count */}
              <div className={css({ textAlign: 'center', color: 'gray.400', fontSize: 'sm' })}>
                Requires mastery of <strong>{currentLevel.digits}-digit</strong> calculations
              </div>
            </div>

            {/* Legend */}
            <div
              className={css({
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6',
                justifyContent: 'center',
                p: '6',
                bg: 'rgba(0, 0, 0, 0.3)',
                rounded: 'lg',
                border: '1px solid',
                borderColor: 'gray.700',
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

            {/* Info Section */}
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
              </div>
            </div>
          </section>
        </div>
      </div>
    </PageWithNav>
  )
}
