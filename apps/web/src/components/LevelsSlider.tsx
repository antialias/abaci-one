'use client'

import { animated } from '@react-spring/web'
import * as Slider from '@radix-ui/react-slider'
import { AbacusReact, StandaloneBead } from '@soroban/abacus-react'
import { css } from '../../styled-system/css'

interface Level {
  level: string
  emoji: string
  color: 'green' | 'blue' | 'violet' | 'amber'
  digits: number
}

interface LevelsSliderProps {
  levels: readonly Level[]
  currentIndex: number
  onIndexChange: (index: number) => void
  onPaneHoverChange: (isHovered: boolean) => void
  emojiTransitions: any
  displayValue: number | bigint
  scaleFactor: number
  animatedProps: any
  darkStyles: any
}

export function LevelsSlider({
  levels,
  currentIndex,
  onIndexChange,
  onPaneHoverChange,
  emojiTransitions,
  displayValue,
  scaleFactor,
  animatedProps,
  darkStyles,
}: LevelsSliderProps) {
  const currentLevel = levels[currentIndex]

  return (
    <div
      onMouseEnter={() => onPaneHoverChange(true)}
      onMouseLeave={() => onPaneHoverChange(false)}
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
        height: { base: 'auto', md: '500px' },
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      {/* Slider */}
      <div className={css({ mb: '6', px: { base: '2', md: '4' } })}>
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
              px: '0',
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
              {levels.map((level, index) => (
                <div
                  key={index}
                  onClick={() => onIndexChange(index)}
                  className={css({
                    fontSize: '3xl',
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
            onValueChange={([value]) => onIndexChange(value)}
            min={0}
            max={levels.length - 1}
            step={1}
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
                w: '120px',
                h: '120px',
                bg: 'transparent',
                cursor: 'grab',
                transition: 'transform 0.15s ease-out',
                zIndex: 10,
                _hover: { transform: 'scale(1.15)' },
                _focus: {
                  outline: 'none',
                  transform: 'scale(1.15)',
                },
                _active: { cursor: 'grabbing' },
              })}
            >
              <div className={css({ opacity: 0.75 })}>
                <StandaloneBead
                  size={120}
                  color={currentLevel.color === 'violet' ? '#8b5cf6' : '#22c55e'}
                  animated={false}
                />
              </div>
              {emojiTransitions((style: any, emoji: string) => (
                <animated.div
                  style={style}
                  className={css({
                    position: 'absolute',
                    fontSize: '6xl',
                    pointerEvents: 'none',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  })}
                >
                  {emoji}
                </animated.div>
              ))}

              <div
                className={css({
                  position: 'absolute',
                  bottom: '-60px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  whiteSpace: 'nowrap',
                })}
              >
                <h3
                  className={css({
                    fontSize: 'xl',
                    fontWeight: 'bold',
                    color:
                      currentLevel.color === 'green'
                        ? 'green.400'
                        : currentLevel.color === 'blue'
                          ? 'blue.400'
                          : currentLevel.color === 'violet'
                            ? 'violet.400'
                            : 'amber.400',
                  })}
                >
                  {currentLevel.level}
                </h3>
              </div>
            </Slider.Thumb>
          </Slider.Root>
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
          flex: 1,
        })}
      >
        <animated.div
          style={{
            transform: animatedProps.scaleFactor.to((s: number) => `scale(${s / scaleFactor})`),
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
      <div
        className={css({
          textAlign: 'center',
          color: 'gray.400',
          fontSize: 'sm',
          mt: '4',
        })}
      >
        Master <strong>{currentLevel.digits}-digit</strong> calculations
      </div>
    </div>
  )
}
