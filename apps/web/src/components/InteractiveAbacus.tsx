'use client'

import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { useSpring, animated } from '@react-spring/web'
import { css } from '../../styled-system/css'
import { TypstSoroban } from './TypstSoroban'

interface InteractiveAbacusProps {
  initialValue?: number
  columns?: number
  className?: string
  onValueChange?: (value: number) => void
  showValue?: boolean
  showControls?: boolean
}

export function InteractiveAbacus({
  initialValue = 0,
  columns = 3,
  className,
  onValueChange,
  showValue = true,
  showControls = true
}: InteractiveAbacusProps) {
  const [currentValue, setCurrentValue] = useState(initialValue)
  const [isChanging, setIsChanging] = useState(false)
  const [previousValue, setPreviousValue] = useState(initialValue)
  const svgRef = useRef<HTMLDivElement>(null)

  // Animated value display
  const valueSpring = useSpring({
    value: currentValue,
    config: { tension: 300, friction: 26 }
  })

  // Container animation for feedback
  const containerSpring = useSpring({
    scale: isChanging ? 1.02 : 1,
    borderColor: isChanging ? '#fbbf24' : '#d97706', // amber-400 vs amber-600
    config: { tension: 400, friction: 25 }
  })

  // Crossfade animation between old and new SVG states
  const crossfadeSpring = useSpring({
    opacity: isChanging ? 0.7 : 1,
    transform: isChanging ? 'scale(0.98)' : 'scale(1)',
    config: { tension: 300, friction: 30 }
  })




  // Handle bead clicks to toggle values
  const handleBeadClick = useCallback((event: Event) => {
    const target = event.target as Element

    // Find the closest element with bead data attributes
    const beadElement = target.closest('[data-bead-type]')
    if (!beadElement) return

    const beadType = beadElement.getAttribute('data-bead-type')
    const beadColumn = parseInt(beadElement.getAttribute('data-bead-column') || '0')
    const beadPosition = beadElement.getAttribute('data-bead-position')
    const isActive = beadElement.getAttribute('data-bead-active') === '1'

    console.log('Bead clicked:', { beadType, beadColumn, beadPosition, isActive })
    console.log('Current value before click:', currentValue)

    if (beadType === 'earth') {
      const position = parseInt(beadPosition || '0')
      const placeValue = beadColumn
      const columnPower = Math.pow(10, placeValue)
      const currentDigit = Math.floor(currentValue / columnPower) % 10
      const heavenContribution = Math.floor(currentDigit / 5) * 5
      const earthContribution = currentDigit % 5
      console.log('Earth bead analysis:', {
        position,
        beadColumn,
        placeValue,
        columnPower,
        currentDigit,
        heavenContribution,
        earthContribution
      })
    }

    if (beadType === 'heaven') {
      // Toggle heaven bead (worth 5)
      // Now using place-value based column numbering: 0=ones, 1=tens, 2=hundreds
      const placeValue = beadColumn
      const columnPower = Math.pow(10, placeValue)
      const heavenValue = 5 * columnPower

      const maxValue = Math.pow(10, columns) - 1

      if (isActive) {
        // Deactivate heaven bead - subtract 5 from this column
        setCurrentValue(prev => Math.max(0, prev - heavenValue))
      } else {
        // Activate heaven bead - add 5 to this column
        setCurrentValue(prev => Math.min(prev + heavenValue, maxValue))
      }
    } else if (beadType === 'earth' && beadPosition) {
      // Toggle earth bead (worth 1 each)
      const position = parseInt(beadPosition) // 0-3 where 0 is top (closest to bar), 3 is bottom
      // Now using place-value based column numbering: 0=ones, 1=tens, 2=hundreds
      const placeValue = beadColumn
      const columnPower = Math.pow(10, placeValue)

      // Calculate current digit in this column
      const currentDigit = Math.floor(currentValue / columnPower) % 10
      const heavenContribution = Math.floor(currentDigit / 5) * 5
      const earthContribution = currentDigit % 5

      let newEarthContribution: number

      // Earth beads are numbered 0-3 from top to bottom (0 is closest to bar)
      // In traditional abacus logic:
      // - earthContribution represents how many beads are active (0-4)
      // - Active beads are positions 0, 1, 2, ... up to (earthContribution - 1)
      // - When you click a bead: toggle that "level" of activation

      if (isActive) {
        // This bead is currently active, so we deactivate it and all beads below it
        // If position 2 is clicked and active, we want positions 0,1 to remain active
        // So earthContribution should be position (2)
        newEarthContribution = position
      } else {
        // This bead is currently inactive, so we activate it and all beads above it
        // If position 2 is clicked and inactive, we want positions 0,1,2 to be active
        // So earthContribution should be position + 1 (3)
        newEarthContribution = position + 1
      }

      console.log('Earth bead calculation:', {
        position,
        isActive,
        currentEarthContribution: earthContribution,
        newEarthContribution
      })

      // Calculate the new digit for this column
      const newDigit = heavenContribution + newEarthContribution

      // Calculate the new total value
      const columnContribution = Math.floor(currentValue / columnPower) % 10 * columnPower
      const newValue = currentValue - columnContribution + (newDigit * columnPower)

      // Ensure value doesn't exceed maximum for this number of columns
      const maxValue = Math.pow(10, columns) - 1
      setCurrentValue(Math.max(0, Math.min(newValue, maxValue)))
    }

    // Visual feedback with extended timing for smoother transition
    setIsChanging(true)

    // Update previous value for crossfade effect
    setPreviousValue(currentValue)

    // Extended timing to allow for smoother crossfade
    setTimeout(() => setIsChanging(false), 300)
  }, [currentValue])

  // Add click event listener for bead interactions
  useEffect(() => {
    const svgContainer = svgRef.current
    if (!svgContainer) return

    svgContainer.addEventListener('click', handleBeadClick)
    return () => {
      svgContainer.removeEventListener('click', handleBeadClick)
    }
  }, [handleBeadClick])

  // Notify parent of value changes
  useMemo(() => {
    onValueChange?.(currentValue)
  }, [currentValue, onValueChange])







  const handleReset = useCallback(() => {
    setIsChanging(true)
    setTimeout(() => setIsChanging(false), 150)
    setCurrentValue(0)
  }, [])

  const handleSetValue = useCallback((value: number) => {
    setIsChanging(true)
    setTimeout(() => setIsChanging(false), 150)
    setCurrentValue(value)
  }, [])

  return (
    <div className={className}>
      <div className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '6',
        alignItems: 'center'
      })}>
        {/* Interactive Abacus using TypstSoroban */}
        <animated.div
          ref={svgRef}
          style={containerSpring}
          className={css({
            width: '300px',
            height: '400px',
            border: '3px solid',
            borderRadius: '12px',
            bg: 'gradient-to-br',
            gradientFrom: 'amber.50',
            gradientTo: 'orange.100',
            padding: '20px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.1)',
            position: 'relative',
            transition: 'all 0.2s ease',
            _hover: {
              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
            }
          })}
        >
          <TypstSoroban
            number={currentValue}
            width="180pt"
            height="240pt"
            className={css({
              width: '100%',
              height: '100%',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              '& [data-bead-type]': {
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                _hover: {
                  filter: 'brightness(1.2)',
                  transform: 'scale(1.05)'
                }
              }
            })}
          />


        </animated.div>

        {/* Value Display */}
        {showValue && (
          <animated.div
            className={css({
              fontSize: '3xl',
              fontWeight: 'bold',
              color: 'blue.600',
              bg: 'blue.50',
              px: '6',
              py: '3',
              rounded: 'xl',
              border: '2px solid',
              borderColor: 'blue.200',
              minW: '120px',
              textAlign: 'center',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.15)'
            })}
          >
            {valueSpring.value.to(val => Math.round(val))}
          </animated.div>
        )}

        {/* Controls */}
        {showControls && (
          <div className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '3',
            flexWrap: 'wrap',
            justifyContent: 'center'
          })}>
            <button
              onClick={handleReset}
              className={css({
                px: '4',
                py: '2',
                bg: 'gray.100',
                color: 'gray.700',
                border: '1px solid',
                borderColor: 'gray.300',
                rounded: 'lg',
                fontSize: 'sm',
                fontWeight: 'medium',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                _hover: {
                  bg: 'gray.200',
                  borderColor: 'gray.400',
                  transform: 'translateY(-1px)'
                },
                _active: {
                  transform: 'scale(0.95)'
                }
              })}
            >
              Clear
            </button>

            {/* Quick preset buttons */}
            {[1, 5, 10, 25, 50, 99].map(preset => (
              <button
                key={preset}
                onClick={() => handleSetValue(preset)}
                className={css({
                  px: '3',
                  py: '2',
                  bg: 'blue.100',
                  color: 'blue.700',
                  border: '1px solid',
                  borderColor: 'blue.300',
                  rounded: 'lg',
                  fontSize: 'sm',
                  fontWeight: 'medium',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  _hover: {
                    bg: 'blue.200',
                    borderColor: 'blue.400',
                    transform: 'translateY(-1px)'
                  },
                  _active: {
                    transform: 'scale(0.95)'
                  }
                })}
              >
                {preset}
              </button>
            ))}
          </div>
        )}

        {/* Instructions */}
        <div className={css({
          fontSize: 'sm',
          color: 'gray.600',
          textAlign: 'center',
          maxW: '450px',
          lineHeight: 'relaxed',
          bg: 'gray.50',
          px: '4',
          py: '3',
          rounded: 'lg',
          border: '1px solid',
          borderColor: 'gray.200'
        })}>
          <strong>How to use:</strong> Click on the beads to activate or deactivate them!
          Heaven beads (top) are worth 5 each, earth beads (bottom) are worth 1 each.
          You can also use the preset buttons below.
        </div>
      </div>
    </div>
  )
}