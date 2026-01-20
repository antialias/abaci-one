'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { css } from '../../../styled-system/css'
import { hstack, vstack } from '../../../styled-system/patterns'

export interface DifficultyDistribution {
  easy: number
  medium: number
  hard: number
}

interface DifficultyDistributionSliderProps {
  /** Current distribution (must sum to 100) */
  distribution: DifficultyDistribution
  /** Called when user drags handles */
  onChange: (distribution: DifficultyDistribution) => void
  /** Available tiers (some flowcharts may only have easy+medium) */
  availableTiers: { easy: boolean; medium: boolean; hard: boolean }
  /** Tier counts from generated examples */
  tierCounts: { easy: number; medium: number; hard: number }
  /** Minimum percentage per available tier (default: 5) */
  minPercentage?: number
}

/**
 * Multi-knob range slider for adjusting difficulty distribution.
 *
 * Visual design:
 * ```
 * Easy          Medium          Hard
 * [====|==============|====]
 *  20%       60%         20%
 * ```
 *
 * Two drag handles divide the bar into three sections.
 * Percentages update as handles are dragged.
 */
export function DifficultyDistributionSlider({
  distribution,
  onChange,
  availableTiers,
  tierCounts,
  minPercentage = 5,
}: DifficultyDistributionSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState<'left' | 'right' | null>(null)

  // Calculate which tiers are active
  const activeTiers = useMemo(() => {
    const tiers: ('easy' | 'medium' | 'hard')[] = []
    if (availableTiers.easy && tierCounts.easy > 0) tiers.push('easy')
    if (availableTiers.medium && tierCounts.medium > 0) tiers.push('medium')
    if (availableTiers.hard && tierCounts.hard > 0) tiers.push('hard')
    return tiers
  }, [availableTiers, tierCounts])

  // Calculate handle positions as percentages
  const leftHandlePos = distribution.easy
  const rightHandlePos = distribution.easy + distribution.medium

  // Get position from event (mouse or touch)
  const getPositionFromEvent = useCallback((e: MouseEvent | TouchEvent): number | null => {
    if (!trackRef.current) return null
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const percentage = ((clientX - rect.left) / rect.width) * 100
    return Math.max(0, Math.min(100, percentage))
  }, [])

  // Handle drag
  const handleDrag = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return

      const pos = getPositionFromEvent(e)
      if (pos === null) return

      let newDistribution: DifficultyDistribution

      if (isDragging === 'left') {
        // Moving the left handle (easy/medium boundary)
        const newEasy = Math.max(minPercentage, Math.min(rightHandlePos - minPercentage, pos))
        const newMedium = rightHandlePos - newEasy
        const newHard = 100 - rightHandlePos
        newDistribution = {
          easy: Math.round(newEasy),
          medium: Math.round(newMedium),
          hard: Math.round(newHard),
        }
      } else {
        // Moving the right handle (medium/hard boundary)
        const newRight = Math.max(leftHandlePos + minPercentage, Math.min(100 - minPercentage, pos))
        const newMedium = newRight - leftHandlePos
        const newHard = 100 - newRight
        newDistribution = {
          easy: Math.round(leftHandlePos),
          medium: Math.round(newMedium),
          hard: Math.round(newHard),
        }
      }

      // Normalize to ensure sum is exactly 100
      const sum = newDistribution.easy + newDistribution.medium + newDistribution.hard
      if (sum !== 100) {
        const diff = 100 - sum
        newDistribution.medium += diff
      }

      onChange(newDistribution)
    },
    [isDragging, leftHandlePos, rightHandlePos, minPercentage, onChange, getPositionFromEvent]
  )

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    setIsDragging(null)
  }, [])

  // Add/remove event listeners
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => handleDrag(e)
    const handleTouchMove = (e: TouchEvent) => handleDrag(e)
    const handleMouseUp = () => handleDragEnd()
    const handleTouchEnd = () => handleDragEnd()

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('touchmove', handleTouchMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchend', handleTouchEnd)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, handleDrag, handleDragEnd])

  // Handle click on track to jump to position
  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      if (!trackRef.current) return

      const rect = trackRef.current.getBoundingClientRect()
      const percentage = ((e.clientX - rect.left) / rect.width) * 100

      // Determine which handle to move based on click position
      const distToLeft = Math.abs(percentage - leftHandlePos)
      const distToRight = Math.abs(percentage - rightHandlePos)

      if (distToLeft < distToRight) {
        // Move left handle
        const newEasy = Math.max(
          minPercentage,
          Math.min(rightHandlePos - minPercentage, percentage)
        )
        const newMedium = rightHandlePos - newEasy
        onChange({
          easy: Math.round(newEasy),
          medium: Math.round(newMedium),
          hard: Math.round(100 - rightHandlePos),
        })
      } else {
        // Move right handle
        const newRight = Math.max(
          leftHandlePos + minPercentage,
          Math.min(100 - minPercentage, percentage)
        )
        const newMedium = newRight - leftHandlePos
        onChange({
          easy: Math.round(leftHandlePos),
          medium: Math.round(newMedium),
          hard: Math.round(100 - newRight),
        })
      }
    },
    [leftHandlePos, rightHandlePos, minPercentage, onChange]
  )

  // If only one tier is available, show a simpler display
  if (activeTiers.length <= 1) {
    return (
      <div
        data-component="difficulty-slider"
        className={vstack({ gap: '2', alignItems: 'center' })}
      >
        <p
          className={css({
            fontSize: 'sm',
            color: { base: 'gray.500', _dark: 'gray.400' },
            textAlign: 'center',
          })}
        >
          {activeTiers.length === 0
            ? 'No examples available'
            : `Only ${activeTiers[0]} problems available (${tierCounts[activeTiers[0]]} examples)`}
        </p>
      </div>
    )
  }

  // If only two tiers are available, show a simpler two-section slider
  if (activeTiers.length === 2) {
    const [tier1, tier2] = activeTiers
    const tier1Percent = tier1 === 'easy' ? distribution.easy : distribution.medium
    const tier2Percent = 100 - tier1Percent

    return (
      <div
        data-component="difficulty-slider"
        className={vstack({ gap: '3', alignItems: 'stretch' })}
      >
        {/* Labels */}
        <div className={hstack({ gap: '4', justifyContent: 'space-between' })}>
          <div className={vstack({ gap: '0', alignItems: 'flex-start' })}>
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: getTierColor(tier1),
              })}
            >
              {getTierLabel(tier1)}
            </span>
            <span
              className={css({
                fontSize: 'xs',
                color: { base: 'gray.500', _dark: 'gray.400' },
              })}
            >
              {tierCounts[tier1]} available
            </span>
          </div>
          <div className={vstack({ gap: '0', alignItems: 'flex-end' })}>
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: 'semibold',
                color: getTierColor(tier2),
              })}
            >
              {getTierLabel(tier2)}
            </span>
            <span
              className={css({
                fontSize: 'xs',
                color: { base: 'gray.500', _dark: 'gray.400' },
              })}
            >
              {tierCounts[tier2]} available
            </span>
          </div>
        </div>

        {/* Simple two-section slider */}
        <div
          ref={trackRef}
          onClick={handleTrackClick}
          className={css({
            position: 'relative',
            height: '24px',
            borderRadius: 'lg',
            overflow: 'hidden',
            cursor: 'pointer',
            display: 'flex',
          })}
        >
          <div
            className={css({ backgroundColor: getTierBgColor(tier1) })}
            style={{ width: `${tier1Percent}%` }}
          />
          <div
            className={css({ backgroundColor: getTierBgColor(tier2) })}
            style={{ width: `${tier2Percent}%` }}
          />

          {/* Handle */}
          <div
            onMouseDown={() => setIsDragging('left')}
            onTouchStart={() => setIsDragging('left')}
            className={css({
              position: 'absolute',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: '20px',
              height: '28px',
              backgroundColor: { base: 'white', _dark: 'gray.300' },
              borderRadius: 'md',
              border: '2px solid',
              borderColor: { base: 'gray.400', _dark: 'gray.500' },
              cursor: 'grab',
              boxShadow: 'md',
              zIndex: 10,
              _hover: { borderColor: { base: 'blue.500', _dark: 'blue.400' } },
              _active: { cursor: 'grabbing' },
            })}
            style={{ left: `${tier1Percent}%` }}
          />
        </div>

        {/* Percentages */}
        <div className={hstack({ gap: '4', justifyContent: 'space-between' })}>
          <span className={css({ fontSize: 'lg', fontWeight: 'bold', color: getTierColor(tier1) })}>
            {Math.round(tier1Percent)}%
          </span>
          <span className={css({ fontSize: 'lg', fontWeight: 'bold', color: getTierColor(tier2) })}>
            {Math.round(tier2Percent)}%
          </span>
        </div>
      </div>
    )
  }

  // Full three-tier slider
  return (
    <div data-component="difficulty-slider" className={vstack({ gap: '3', alignItems: 'stretch' })}>
      {/* Labels */}
      <div className={hstack({ gap: '2', justifyContent: 'space-between' })}>
        <div className={vstack({ gap: '0', alignItems: 'flex-start' })}>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'semibold',
              color: { base: 'emerald.600', _dark: 'emerald.400' },
            })}
          >
            Easy
          </span>
          <span
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.500', _dark: 'gray.400' },
            })}
          >
            {tierCounts.easy} available
          </span>
        </div>
        <div className={vstack({ gap: '0', alignItems: 'center' })}>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'semibold',
              color: { base: 'amber.600', _dark: 'amber.400' },
            })}
          >
            Medium
          </span>
          <span
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.500', _dark: 'gray.400' },
            })}
          >
            {tierCounts.medium} available
          </span>
        </div>
        <div className={vstack({ gap: '0', alignItems: 'flex-end' })}>
          <span
            className={css({
              fontSize: 'sm',
              fontWeight: 'semibold',
              color: { base: 'rose.600', _dark: 'rose.400' },
            })}
          >
            Hard
          </span>
          <span
            className={css({
              fontSize: 'xs',
              color: { base: 'gray.500', _dark: 'gray.400' },
            })}
          >
            {tierCounts.hard} available
          </span>
        </div>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        className={css({
          position: 'relative',
          height: '24px',
          borderRadius: 'lg',
          overflow: 'hidden',
          cursor: 'pointer',
          display: 'flex',
        })}
      >
        {/* Easy section */}
        <div
          className={css({
            backgroundColor: { base: 'emerald.400', _dark: 'emerald.600' },
            transition: 'width 0.1s',
          })}
          style={{ width: `${distribution.easy}%` }}
        />
        {/* Medium section */}
        <div
          className={css({
            backgroundColor: { base: 'amber.400', _dark: 'amber.600' },
            transition: 'width 0.1s',
          })}
          style={{ width: `${distribution.medium}%` }}
        />
        {/* Hard section */}
        <div
          className={css({
            backgroundColor: { base: 'rose.400', _dark: 'rose.600' },
            transition: 'width 0.1s',
          })}
          style={{ width: `${distribution.hard}%` }}
        />

        {/* Left handle (easy/medium boundary) */}
        <div
          data-handle="left"
          onMouseDown={() => setIsDragging('left')}
          onTouchStart={() => setIsDragging('left')}
          className={css({
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '16px',
            height: '28px',
            backgroundColor: { base: 'white', _dark: 'gray.300' },
            borderRadius: 'md',
            border: '2px solid',
            borderColor:
              isDragging === 'left'
                ? { base: 'blue.500', _dark: 'blue.400' }
                : { base: 'gray.400', _dark: 'gray.500' },
            cursor: 'grab',
            boxShadow: 'md',
            zIndex: 10,
            transition: 'border-color 0.15s',
            _hover: { borderColor: { base: 'blue.500', _dark: 'blue.400' } },
            _active: { cursor: 'grabbing' },
          })}
          style={{ left: `${distribution.easy}%` }}
        />

        {/* Right handle (medium/hard boundary) */}
        <div
          data-handle="right"
          onMouseDown={() => setIsDragging('right')}
          onTouchStart={() => setIsDragging('right')}
          className={css({
            position: 'absolute',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: '16px',
            height: '28px',
            backgroundColor: { base: 'white', _dark: 'gray.300' },
            borderRadius: 'md',
            border: '2px solid',
            borderColor:
              isDragging === 'right'
                ? { base: 'blue.500', _dark: 'blue.400' }
                : { base: 'gray.400', _dark: 'gray.500' },
            cursor: 'grab',
            boxShadow: 'md',
            zIndex: 10,
            transition: 'border-color 0.15s',
            _hover: { borderColor: { base: 'blue.500', _dark: 'blue.400' } },
            _active: { cursor: 'grabbing' },
          })}
          style={{ left: `${distribution.easy + distribution.medium}%` }}
        />
      </div>

      {/* Percentages */}
      <div className={hstack({ gap: '2', justifyContent: 'space-between' })}>
        <span
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            color: { base: 'emerald.600', _dark: 'emerald.400' },
          })}
        >
          {distribution.easy}%
        </span>
        <span
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            color: { base: 'amber.600', _dark: 'amber.400' },
          })}
        >
          {distribution.medium}%
        </span>
        <span
          className={css({
            fontSize: 'lg',
            fontWeight: 'bold',
            color: { base: 'rose.600', _dark: 'rose.400' },
          })}
        >
          {distribution.hard}%
        </span>
      </div>
    </div>
  )
}

// Helper functions for tier colors
function getTierLabel(tier: 'easy' | 'medium' | 'hard'): string {
  switch (tier) {
    case 'easy':
      return 'Easy'
    case 'medium':
      return 'Medium'
    case 'hard':
      return 'Hard'
  }
}

function getTierColor(tier: 'easy' | 'medium' | 'hard') {
  switch (tier) {
    case 'easy':
      return { base: 'emerald.600', _dark: 'emerald.400' }
    case 'medium':
      return { base: 'amber.600', _dark: 'amber.400' }
    case 'hard':
      return { base: 'rose.600', _dark: 'rose.400' }
  }
}

function getTierBgColor(tier: 'easy' | 'medium' | 'hard') {
  switch (tier) {
    case 'easy':
      return { base: 'emerald.400', _dark: 'emerald.600' }
    case 'medium':
      return { base: 'amber.400', _dark: 'amber.600' }
    case 'hard':
      return { base: 'rose.400', _dark: 'rose.600' }
  }
}
