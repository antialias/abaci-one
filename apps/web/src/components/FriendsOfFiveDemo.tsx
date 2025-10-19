'use client'

import { AbacusReact, useAbacusConfig } from '@soroban/abacus-react'
import { useCallback, useEffect, useState } from 'react'
import { css } from '../../styled-system/css'
import { stack } from '../../styled-system/patterns'

/**
 * Compact "Friends of 5" demo for the homepage
 * Shows an interactive example of learning soroban concepts
 */
export function FriendsOfFiveDemo() {
  const [currentValue, setCurrentValue] = useState(2)
  const [targetValue] = useState(5)
  const [feedback, setFeedback] = useState<string>('Try adding 3 more beads to make 5!')
  const [isCorrect, setIsCorrect] = useState(false)
  const appConfig = useAbacusConfig()

  const handleValueChange = useCallback(
    (newValue: number) => {
      setCurrentValue(newValue)

      if (newValue === targetValue) {
        setIsCorrect(true)
        setFeedback('Perfect! You made 5! This is the "Friends of 5" concept.')
      } else if (newValue > targetValue) {
        setFeedback('Oops! Too many beads. Try to make exactly 5.')
      } else {
        setFeedback(`Add ${targetValue - newValue} more to make 5!`)
      }
    },
    [targetValue]
  )

  // Reset after 3 seconds when correct
  useEffect(() => {
    if (isCorrect) {
      const timeout = setTimeout(() => {
        setCurrentValue(2)
        setIsCorrect(false)
        setFeedback('Try adding 3 more beads to make 5!')
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [isCorrect])

  return (
    <div
      className={stack({
        gap: '4',
        bg: 'rgba(255, 255, 255, 0.05)',
        p: '6',
        borderRadius: 'xl',
        border: '1px solid rgba(139, 92, 246, 0.2)',
      })}
    >
      {/* Title */}
      <div className={css({ textAlign: 'center' })}>
        <h4
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            color: 'white',
            mb: '2',
          })}
        >
          Try It Now: Friends of 5
        </h4>
        <p className={css({ fontSize: 'sm', color: 'gray.300' })}>Problem: 2 + 3 = ?</p>
      </div>

      {/* Interactive Abacus */}
      <div
        className={css({
          display: 'flex',
          justifyContent: 'center',
          bg: 'white',
          p: '4',
          borderRadius: 'lg',
          minHeight: '200px',
          alignItems: 'center',
        })}
      >
        <AbacusReact
          value={currentValue}
          columns={1}
          beadShape={appConfig.beadShape}
          colorScheme={appConfig.colorScheme}
          hideInactiveBeads={appConfig.hideInactiveBeads}
          interactive={true}
          animated={true}
          soundEnabled={true}
          soundVolume={0.3}
          scaleFactor={1.8}
          showNumbers={true}
          onValueChange={handleValueChange}
        />
      </div>

      {/* Feedback */}
      <div
        className={css({
          p: '3',
          bg: isCorrect ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)',
          border: '1px solid',
          borderColor: isCorrect ? 'rgba(34, 197, 94, 0.3)' : 'rgba(59, 130, 246, 0.3)',
          borderRadius: 'md',
          textAlign: 'center',
        })}
      >
        <p
          className={css({
            fontSize: 'sm',
            color: isCorrect ? 'green.300' : 'blue.300',
            fontWeight: 'medium',
          })}
        >
          {feedback}
        </p>
      </div>

      <div className={css({ textAlign: 'center', fontSize: 'xs', color: 'gray.400' })}>
        Click the beads to move them up or down
      </div>
    </div>
  )
}
