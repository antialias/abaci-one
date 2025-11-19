'use client'

import { useEffect, useState } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'
import { getFilteredMapData } from '../maps'
import type { MapRegion } from '../types'
import { getRegionColor, getLabelTextColor, getLabelTextShadow } from '../mapColors'

export function StudyPhase() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, endStudy } = useKnowYourWorld()

  const [timeRemaining, setTimeRemaining] = useState(state.studyTimeRemaining)

  const mapData = getFilteredMapData(state.selectedMap, state.selectedContinent, state.difficulty)

  // Countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        const newTime = Math.max(0, prev - 1)

        // Auto-transition to playing phase when timer reaches 0
        if (newTime === 0) {
          clearInterval(interval)
          setTimeout(() => endStudy(), 100)
        }

        return newTime
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [endStudy])

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <div
      data-component="study-phase"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        paddingTop: '20',
        paddingX: '4',
        paddingBottom: '4',
        maxWidth: '1200px',
        margin: '0 auto',
      })}
    >
      {/* Header with timer */}
      <div
        data-section="study-header"
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '4',
          bg: isDark ? 'blue.900' : 'blue.50',
          rounded: 'xl',
          border: '2px solid',
          borderColor: isDark ? 'blue.700' : 'blue.200',
        })}
      >
        <div>
          <h2
            className={css({
              fontSize: '2xl',
              fontWeight: 'bold',
              color: isDark ? 'blue.100' : 'blue.900',
            })}
          >
            Study Time 📚
          </h2>
          <p
            className={css({
              fontSize: 'sm',
              color: isDark ? 'blue.300' : 'blue.700',
            })}
          >
            Memorize the locations - the quiz starts when the timer ends!
          </p>
        </div>

        <div
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '2',
          })}
        >
          <div
            className={css({
              fontSize: '4xl',
              fontWeight: 'bold',
              color:
                timeRemaining <= 10
                  ? isDark
                    ? 'red.400'
                    : 'red.600'
                  : isDark
                    ? 'blue.200'
                    : 'blue.800',
              fontFeatureSettings: '"tnum"',
            })}
          >
            {formatTime(timeRemaining)}
          </div>
          <button
            data-action="skip-study"
            onClick={endStudy}
            className={css({
              padding: '2',
              paddingX: '4',
              rounded: 'lg',
              bg: isDark ? 'gray.700' : 'gray.200',
              color: isDark ? 'gray.200' : 'gray.800',
              fontSize: 'sm',
              fontWeight: 'semibold',
              cursor: 'pointer',
              transition: 'all 0.2s',
              _hover: {
                bg: isDark ? 'gray.600' : 'gray.300',
              },
            })}
          >
            Skip to Game →
          </button>
        </div>
      </div>

      {/* Map with all labels visible */}
      <div
        data-element="study-map"
        className={css({
          width: '100%',
          maxWidth: '1000px',
          margin: '0 auto',
          padding: '4',
          bg: isDark ? 'gray.900' : 'gray.50',
          rounded: 'xl',
          shadow: 'lg',
        })}
      >
        <svg
          viewBox={mapData.viewBox}
          className={css({
            width: '100%',
            height: 'auto',
          })}
        >
          {/* Background */}
          <rect x="0" y="0" width="100%" height="100%" fill={isDark ? '#111827' : '#f3f4f6'} />

          {/* Render all regions with labels */}
          {mapData.regions.map((region: MapRegion) => (
            <g key={region.id}>
              {/* Region path */}
              <path
                d={region.path}
                fill={getRegionColor(region.id, false, false, isDark)}
                stroke={isDark ? '#1f2937' : '#ffffff'}
                strokeWidth={0.5}
                style={{
                  pointerEvents: 'none',
                }}
              />

              {/* Region label - ALWAYS visible during study */}
              <text
                x={region.center[0]}
                y={region.center[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={getLabelTextColor(isDark, false)}
                fontSize="10"
                fontWeight="bold"
                pointerEvents="none"
                style={{
                  textShadow: getLabelTextShadow(isDark, false),
                }}
              >
                {region.name}
              </text>
            </g>
          ))}
        </svg>
      </div>

      {/* Study tips */}
      <div
        className={css({
          padding: '4',
          bg: isDark ? 'gray.800' : 'gray.100',
          rounded: 'lg',
          fontSize: 'sm',
          color: isDark ? 'gray.300' : 'gray.700',
        })}
      >
        <p className={css({ fontWeight: 'semibold', marginBottom: '2' })}>💡 Study Tips:</p>
        <ul
          className={css({
            listStyle: 'disc',
            paddingLeft: '5',
            display: 'flex',
            flexDirection: 'column',
            gap: '1',
          })}
        >
          <li>Look for patterns - neighboring regions, shapes, sizes</li>
          <li>Group regions mentally by area (e.g., Northeast, Southwest)</li>
          <li>Focus on the tricky small ones that are hard to see</li>
          <li>The quiz will be in random order - study them all!</li>
        </ul>
      </div>
    </div>
  )
}
