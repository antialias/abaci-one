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
              transition: 'all 0.3s ease'
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
          <strong>How to use:</strong> Use the preset buttons below to set different values.
          The abacus will display the number using traditional soroban bead positions.
        </div>
      </div>
    </div>
  )
}