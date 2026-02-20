'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { css } from '../../../../styled-system/css'
import { DifficultyPlot2D } from '@/app/create/worksheets/components/config-panel/DifficultyPlot2D'

/**
 * Hero wrapper for DifficultyPlot2D.
 * The plot is a 500×500 square but the hero is 2.4:1 — we scale it to
 * fit the available height and center it horizontally.
 */
export default function DifficultyPlotHero() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const measure = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    // The plot's intrinsic height includes the 500px SVG + 16px padding top/bottom + 2px border
    const plotIntrinsicHeight = 534
    const availableHeight = el.clientHeight
    const newScale = Math.min(1, availableHeight / plotIntrinsicHeight)
    setScale(newScale)
  }, [])

  useEffect(() => {
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [measure])

  return (
    <div
      ref={containerRef}
      data-component="difficulty-plot-hero"
      className={css({
        width: '100%',
        height: '100%',
        bg: '#0d1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      })}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <DifficultyPlot2D
          pAnyStart={0.5}
          pAllStart={0.2}
          displayRules={{
            carryBoxes: 'always',
            answerBoxes: 'always',
            placeValueColors: 'always',
            tenFrames: 'never',
            problemNumbers: 'always',
            cellBorders: 'always',
            borrowNotation: 'never',
            borrowingHints: 'never',
          }}
          onChange={() => {}}
          isDark={true}
          customPoints={[
            {
              id: 'beginner',
              label: 'Beginner',
              pAnyStart: 0.1,
              pAllStart: 0.0,
              displayRules: {
                carryBoxes: 'always',
                answerBoxes: 'always',
                placeValueColors: 'always',
                tenFrames: 'always',
                problemNumbers: 'always',
                cellBorders: 'always',
                borrowNotation: 'always',
                borrowingHints: 'always',
              },
            },
            {
              id: 'intermediate',
              label: 'Intermediate',
              pAnyStart: 0.5,
              pAllStart: 0.2,
              displayRules: {
                carryBoxes: 'always',
                answerBoxes: 'always',
                placeValueColors: 'always',
                tenFrames: 'never',
                problemNumbers: 'always',
                cellBorders: 'always',
                borrowNotation: 'never',
                borrowingHints: 'never',
              },
            },
            {
              id: 'advanced',
              label: 'Advanced',
              pAnyStart: 0.8,
              pAllStart: 0.6,
              displayRules: {
                carryBoxes: 'whenRegrouping',
                answerBoxes: 'always',
                placeValueColors: 'never',
                tenFrames: 'never',
                problemNumbers: 'always',
                cellBorders: 'never',
                borrowNotation: 'never',
                borrowingHints: 'never',
              },
            },
            {
              id: 'expert',
              label: 'Expert',
              pAnyStart: 1.0,
              pAllStart: 1.0,
              displayRules: {
                carryBoxes: 'never',
                answerBoxes: 'never',
                placeValueColors: 'never',
                tenFrames: 'never',
                problemNumbers: 'never',
                cellBorders: 'never',
                borrowNotation: 'never',
                borrowingHints: 'never',
              },
            },
          ]}
        />
      </div>
    </div>
  )
}
