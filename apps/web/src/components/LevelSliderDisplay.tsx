'use client'

import { useState, useEffect } from 'react'
import { useSpring, useTransition, animated } from '@react-spring/web'
import * as Slider from '@radix-ui/react-slider'
import { AbacusReact, StandaloneBead, ABACUS_THEMES } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'
import { stack } from '../../styled-system/patterns'
import { kyuLevelDetails } from '@/data/kyuLevelDetails'

// Combine all levels into one array for the slider
const allLevels = [
  {
    level: '10th Kyu',
    emoji: '🧒',
    color: 'green',
    digits: 2,
    type: 'kyu' as const,
  },
  {
    level: '9th Kyu',
    emoji: '🧒',
    color: 'green',
    digits: 2,
    type: 'kyu' as const,
  },
  {
    level: '8th Kyu',
    emoji: '🧒',
    color: 'green',
    digits: 3,
    type: 'kyu' as const,
  },
  {
    level: '7th Kyu',
    emoji: '🧒',
    color: 'green',
    digits: 4,
    type: 'kyu' as const,
  },
  {
    level: '6th Kyu',
    emoji: '🧑',
    color: 'blue',
    digits: 5,
    type: 'kyu' as const,
  },
  {
    level: '5th Kyu',
    emoji: '🧑',
    color: 'blue',
    digits: 6,
    type: 'kyu' as const,
  },
  {
    level: '4th Kyu',
    emoji: '🧑',
    color: 'blue',
    digits: 7,
    type: 'kyu' as const,
  },
  {
    level: '3rd Kyu',
    emoji: '🧔',
    color: 'violet',
    digits: 8,
    type: 'kyu' as const,
  },
  {
    level: '2nd Kyu',
    emoji: '🧔',
    color: 'violet',
    digits: 9,
    type: 'kyu' as const,
  },
  {
    level: '1st Kyu',
    emoji: '🧔',
    color: 'violet',
    digits: 10,
    type: 'kyu' as const,
  },
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

// Helper function to map level names to kyuLevelDetails keys
function getLevelDetailsKey(levelName: string): string | null {
  // Convert "10th Kyu" → "10-kyu", "3rd Kyu" → "3-kyu", etc.
  const match = levelName.match(/^(\d+)(?:st|nd|rd|th)\s+Kyu$/)
  if (match) {
    return `${match[1]}-kyu`
  }
  return null
}

// Parse and format kyu level details into structured sections with icons
function parseKyuDetails(rawText: string) {
  const lines = rawText.split('\n').filter((line) => line.trim() && !line.includes('shuzan.jp'))

  // Always return sections in consistent order: Add/Sub, Multiply, Divide
  const sections: Array<{
    type: 'addSub' | 'multiply' | 'divide'
    icon: string
    label: string
    digits: string | null
    rows: string | null
    chars: string | null
    problems: string | null
  }> = [
    {
      type: 'addSub',
      icon: '➕➖',
      label: 'Add/Sub',
      digits: null,
      rows: null,
      chars: null,
      problems: null,
    },
    {
      type: 'multiply',
      icon: '✖️',
      label: 'Multiply',
      digits: null,
      rows: null,
      chars: null,
      problems: null,
    },
    {
      type: 'divide',
      icon: '➗',
      label: 'Divide',
      digits: null,
      rows: null,
      chars: null,
      problems: null,
    },
  ]

  for (const line of lines) {
    if (line.includes('Add/Sub:')) {
      const match = line.match(/(\d+)-digit.*?(\d+)口.*?(\d+)字/)
      if (match) {
        sections[0].digits = match[1]
        sections[0].rows = match[2]
        sections[0].chars = match[3]
      }
    } else if (line.includes('×:')) {
      const match = line.match(/(\d+) digits.*?\((\d+)/)
      if (match) {
        sections[1].digits = match[1]
        sections[1].problems = match[2]
      }
    } else if (line.includes('÷:')) {
      const match = line.match(/(\d+) digits.*?\((\d+)/)
      if (match) {
        sections[2].digits = match[1]
        sections[2].problems = match[2]
      }
    }
  }

  return sections
}

// Use dark theme preset from abacus-react instead of manual definition
const darkStyles = ABACUS_THEMES.dark

interface LevelSliderDisplayProps {
  initialIndex?: number
  autoAdvanceEnabled?: boolean
  autoAdvanceInterval?: number
  showLegend?: boolean
}

export function LevelSliderDisplay({
  initialIndex = 0,
  autoAdvanceEnabled = true,
  autoAdvanceInterval = 3000,
  showLegend = true,
}: LevelSliderDisplayProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isHovering, setIsHovering] = useState(false)
  const [isPaneHovered, setIsPaneHovered] = useState(false)
  const currentLevel = allLevels[currentIndex]

  // State for animated abacus digits
  const [animatedDigits, setAnimatedDigits] = useState<string>('')

  // Initialize animated digits when level changes
  useEffect(() => {
    const generateRandomDigits = (numDigits: number) => {
      return Array.from({ length: numDigits }, () => Math.floor(Math.random() * 10)).join('')
    }
    setAnimatedDigits(generateRandomDigits(currentLevel.digits))
  }, [currentLevel.digits])

  // Animate abacus calculations - speed increases with Dan level
  useEffect(() => {
    // Calculate animation speed based on level
    // Kyu levels: 500ms
    // Pre-1st Dan: 500ms
    // 1st-10th Dan: interpolate from 500ms to 10ms
    const getAnimationInterval = () => {
      if (currentIndex < 11) {
        // Kyu levels and Pre-1st Dan: constant 500ms
        return 500
      }
      // 1st Dan through 10th Dan: speed up from 500ms to 10ms
      // Index 11 (1st Dan) → 500ms
      // Index 20 (10th Dan) → 10ms
      const danProgress = (currentIndex - 11) / 9 // 0.0 to 1.0
      return 500 - danProgress * 490 // 500ms down to 10ms
    }

    const intervalMs = getAnimationInterval()

    const interval = setInterval(() => {
      setAnimatedDigits((prev) => {
        const digits = prev.split('').map(Number)
        const numColumns = digits.length

        // Pick 1-3 adjacent columns to change (grouping effect)
        const groupSize = Math.floor(Math.random() * 3) + 1
        const startCol = Math.floor(Math.random() * (numColumns - groupSize + 1))

        // Change the selected columns
        for (let i = startCol; i < startCol + groupSize && i < numColumns; i++) {
          digits[i] = Math.floor(Math.random() * 10)
        }

        return digits.join('')
      })
    }, intervalMs)

    return () => clearInterval(interval)
  }, [currentIndex])

  // Auto-advance slider position every 3 seconds (unless pane is hovered)
  useEffect(() => {
    if (!autoAdvanceEnabled || isPaneHovered) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        // Cycle back to 0 when reaching the end
        return prev >= allLevels.length - 1 ? 0 : prev + 1
      })
    }, autoAdvanceInterval)

    return () => clearInterval(interval)
  }, [autoAdvanceEnabled, isPaneHovered, autoAdvanceInterval])

  // Handle hover on slider track
  const handleSliderHover = (e: React.MouseEvent<HTMLSpanElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percentage = x / rect.width
    const index = Math.round(percentage * (allLevels.length - 1))
    setCurrentIndex(Math.max(0, Math.min(allLevels.length - 1, index)))
  }

  // Calculate scale factor based on number of columns to fit the page
  // Use constrained range to prevent huge size differences between levels
  // Min 1.2 (for 30-column Dan levels) to Max 2.0 (for 2-column Kyu levels)
  const scaleFactor = Math.max(1.2, Math.min(2.0, 20 / currentLevel.digits))

  // Animate scale factor with React Spring for smooth transitions
  const animatedProps = useSpring({
    scaleFactor,
    config: { tension: 350, friction: 45 },
  })

  // Animate emoji with proper cross-fade (old fades out, new fades in)
  const emojiTransitions = useTransition(currentLevel.emoji, {
    keys: currentIndex,
    from: { opacity: 0 },
    enter: { opacity: 1 },
    leave: { opacity: 0 },
    config: { duration: 120 },
  })

  // Convert animated digits to a number/BigInt for the abacus display
  // Use BigInt for large numbers to get full 30-digit precision
  const displayValue =
    animatedDigits.length > 15
      ? BigInt(animatedDigits || '0')
      : Number.parseInt(animatedDigits || '0', 10)

  return (
    <div className={stack({ gap: '8' })}>
      {/* Current Level Display */}
      <div
        onMouseEnter={() => setIsPaneHovered(true)}
        onMouseLeave={() => setIsPaneHovered(false)}
        className={css({
          bg: 'transparent',
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
          p: { base: '4', md: '8' },
          height: { base: 'auto', md: '700px' },
          maxHeight: { base: '500px', md: 'none' },
          display: 'flex',
          flexDirection: 'column',
        })}
      >
        {/* Abacus-themed Radix Slider */}
        <div className={css({ mb: '6', px: { base: '2', md: '8' } })}>
          <div className={css({ position: 'relative', py: '12' })}>
            {/* Emoji tick marks */}
            <div
              className={css({
                position: 'absolute',
                top: '0',
                left: '0',
                right: '0',
                h: 'full',
                display: 'flex',
                alignItems: 'center',
                pointerEvents: 'none',
                px: '0', // Use full width for tick spacing
              })}
            >
              <div
                className={css({
                  position: 'relative',
                  w: 'full',
                  display: 'flex',
                  justifyContent: 'space-between',
                })}
              >
                {allLevels.map((level, index) => (
                  <div
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={css({
                      fontSize: { base: '2xl', sm: '3xl', md: '4xl' },
                      opacity: index === currentIndex ? '1' : '0.3',
                      transition: 'all 0.2s',
                      cursor: 'pointer',
                      pointerEvents: 'auto',
                      _hover: { opacity: index === currentIndex ? '1' : '0.6' },
                    })}
                  >
                    {level.emoji}
                  </div>
                ))}
              </div>
            </div>

            <Slider.Root
              value={[currentIndex]}
              onValueChange={([value]) => setCurrentIndex(value)}
              min={0}
              max={allLevels.length - 1}
              step={1}
              onMouseMove={handleSliderHover}
              onMouseEnter={() => setIsHovering(true)}
              onMouseLeave={() => setIsHovering(false)}
              className={css({
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                userSelect: 'none',
                touchAction: 'none',
                w: 'full',
                h: '32',
                cursor: 'pointer',
              })}
            >
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                  w: { base: '120px', md: '180px' },
                  h: { base: '96px', md: '128px' },
                  bg: 'transparent',
                  cursor: 'grab',
                  transition: 'transform 0.15s ease-out, left 0.3s ease-out',
                  zIndex: 10,
                  _hover: { transform: 'scale(1.15)' },
                  _focus: {
                    outline: 'none',
                    transform: 'scale(1.15)',
                  },
                  _active: { cursor: 'grabbing' },
                })}
              >
                <div
                  className={css({
                    opacity: 0.75,
                    transform: { base: 'scale(0.75)', md: 'scale(1)' },
                  })}
                >
                  <StandaloneBead
                    size={128}
                    color={currentLevel.color === 'violet' ? '#8b5cf6' : '#22c55e'}
                    animated={false}
                  />
                </div>
                {emojiTransitions((style, emoji) => (
                  <animated.div
                    style={style}
                    className={css({
                      position: 'absolute',
                      fontSize: '9xl',
                      pointerEvents: 'none',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                    })}
                  >
                    {emoji}
                  </animated.div>
                ))}

                {/* Level text as part of the bead display */}
                <div
                  className={css({
                    position: 'absolute',
                    bottom: '-80px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    textAlign: 'center',
                    pointerEvents: 'none',
                    whiteSpace: 'nowrap',
                  })}
                >
                  <h2
                    className={css({
                      fontSize: '2xl',
                      fontWeight: 'bold',
                      color:
                        currentLevel.color === 'green'
                          ? 'green.400'
                          : currentLevel.color === 'blue'
                            ? 'blue.400'
                            : currentLevel.color === 'violet'
                              ? 'violet.400'
                              : 'amber.400',
                      mb: '0.5',
                    })}
                  >
                    {currentLevel.level}
                  </h2>
                  {'name' in currentLevel && (
                    <div
                      className={css({
                        fontSize: 'md',
                        color: 'gray.300',
                        mb: '0.5',
                      })}
                    >
                      {currentLevel.name}
                    </div>
                  )}
                  {'minScore' in currentLevel && (
                    <div className={css({ fontSize: 'sm', color: 'gray.400' })}>
                      Min: {currentLevel.minScore}pts
                    </div>
                  )}
                </div>
              </Slider.Thumb>
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

        {/* Abacus Display with Level Details */}
        <div
          className={css({
            display: 'flex',
            flexDirection: { base: 'column', lg: 'row' },
            gap: '4',
            p: { base: '4', md: '6' },
            bg: 'rgba(0, 0, 0, 0.3)',
            rounded: 'lg',
            border: '1px solid',
            borderColor: 'gray.700',
            overflow: 'hidden',
            flex: 1,
            minH: 0, // Allow flex shrinking
          })}
        >
          {/* Level Details (only for Kyu levels) */}
          {currentLevel.type === 'kyu' &&
            (() => {
              const detailsKey = getLevelDetailsKey(currentLevel.level)
              const rawText = detailsKey
                ? kyuLevelDetails[detailsKey as keyof typeof kyuLevelDetails]
                : null
              const sections = rawText ? parseKyuDetails(rawText) : []

              // Use consistent sizing across all levels
              const sizing = { fontSize: 'md', gap: '3', iconSize: '4xl' }

              return sections.length > 0 ? (
                <div
                  className={css({
                    flex: '0 0 auto',
                    display: { base: 'none', lg: 'grid' },
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '2',
                    p: '2',
                    w: '100%',
                    maxW: '400px',
                    alignContent: 'center',
                    justifyItems: 'center',
                  })}
                >
                  {sections.map((section, idx) => {
                    const hasData = section.digits !== null
                    const levelColor =
                      currentLevel.color === 'green'
                        ? 'green.300'
                        : currentLevel.color === 'blue'
                          ? 'blue.300'
                          : 'violet.300'

                    return (
                      <div
                        key={idx}
                        className={css({
                          bg: hasData ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.2)',
                          border: '1px solid',
                          borderColor: hasData ? 'gray.700' : 'gray.800',
                          rounded: 'md',
                          p: '3',
                          transition: 'all 0.2s',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '1.5',
                          opacity: hasData ? 1 : 0.3,
                          w: { base: '100%', sm: 'auto' },
                          minW: { sm: '140px' },
                          maxW: { base: '170px', sm: '170px' },
                          minH: '150px',
                          _hover: hasData
                            ? {
                                borderColor: 'gray.500',
                                transform: 'scale(1.05)',
                              }
                            : {},
                        })}
                      >
                        <span
                          className={css({
                            fontSize: sizing.iconSize,
                            lineHeight: '1',
                          })}
                        >
                          {section.icon}
                        </span>
                        {hasData && section.digits && (
                          <>
                            <div
                              className={css({
                                fontSize: '2xl',
                                fontWeight: 'bold',
                                color: levelColor,
                              })}
                            >
                              {section.digits} digits
                            </div>
                            {(section.rows || section.chars) && (
                              <div
                                className={css({
                                  fontSize: 'sm',
                                  color: 'gray.400',
                                  textAlign: 'center',
                                })}
                              >
                                {section.rows && `${section.rows} rows`}
                                {section.rows && section.chars && ' • '}
                                {section.chars && `${section.chars} chars`}
                              </div>
                            )}
                            {section.problems && (
                              <div
                                className={css({
                                  fontSize: 'sm',
                                  color: 'gray.400',
                                  textAlign: 'center',
                                })}
                              >
                                {section.problems} problems
                              </div>
                            )}
                          </>
                        )}
                        <div
                          className={css({
                            fontSize: 'xs',
                            color: hasData ? 'gray.500' : 'gray.700',
                            textAlign: 'center',
                            fontWeight: hasData ? 'normal' : 'bold',
                          })}
                        >
                          {section.label}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : null
            })()}

          {/* Abacus (centered on mobile, right-aligned for Kyu on desktop, centered for Dan) */}
          <div
            className={css({
              display: 'flex',
              justifyContent:
                currentLevel.type === 'kyu' ? { base: 'center', lg: 'flex-end' } : 'center',
              alignItems: 'center',
              flex: 1,
              overflowX: 'auto',
              overflowY: 'hidden',
              minW: 0, // Allow flex shrinking
              minH: 0, // Allow flex shrinking
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
        </div>

        {/* Digit Count */}
        <div
          className={css({
            textAlign: 'center',
            color: 'gray.400',
            fontSize: 'sm',
          })}
        >
          Requires mastery of <strong>{currentLevel.digits}-digit</strong> calculations
        </div>
      </div>

      {/* Legend */}
      {showLegend && (
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
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            })}
          >
            <div
              className={css({
                w: '4',
                h: '4',
                bg: 'green.500',
                rounded: 'sm',
              })}
            />
            <span className={css({ fontSize: 'sm', color: 'gray.300' })}>Beginner (10-7 Kyu)</span>
          </div>
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            })}
          >
            <div
              className={css({
                w: '4',
                h: '4',
                bg: 'blue.500',
                rounded: 'sm',
              })}
            />
            <span className={css({ fontSize: 'sm', color: 'gray.300' })}>
              Intermediate (6-4 Kyu)
            </span>
          </div>
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            })}
          >
            <div
              className={css({
                w: '4',
                h: '4',
                bg: 'violet.500',
                rounded: 'sm',
              })}
            />
            <span className={css({ fontSize: 'sm', color: 'gray.300' })}>Advanced (3-1 Kyu)</span>
          </div>
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
            })}
          >
            <div
              className={css({
                w: '4',
                h: '4',
                bg: 'amber.500',
                rounded: 'sm',
              })}
            />
            <span className={css({ fontSize: 'sm', color: 'gray.300' })}>Master (Dan ranks)</span>
          </div>
        </div>
      )}
    </div>
  )
}
