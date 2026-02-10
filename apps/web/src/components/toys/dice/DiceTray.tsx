'use client'

import { useCallback, useMemo, useState } from 'react'
import { InteractiveDice } from '@/components/ui/InteractiveDice'
import { useTheme } from '@/contexts/ThemeContext'
import { COLOR_KEYS, DICE_COLORS, getNextColor } from './diceColors'
import { ToyDebugPanel, DebugSlider } from '../ToyDebugPanel'

interface DieState {
  id: string
  colorKey: string
  value: number | null
}

let nextId = 1
function makeId() {
  return `die-${nextId++}`
}

export function DiceTray() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [dice, setDice] = useState<DieState[]>(() => [
    { id: makeId(), colorKey: 'indigo', value: null },
    { id: makeId(), colorKey: 'red', value: null },
  ])

  const [rollTrigger, setRollTrigger] = useState(0)
  const [hoveredDie, setHoveredDie] = useState<string | null>(null)
  const [perspective, setPerspective] = useState(250)

  const sum = useMemo(
    () => dice.reduce((acc, d) => acc + (d.value ?? 0), 0),
    [dice]
  )

  const hasValues = dice.some((d) => d.value !== null)

  const addDie = useCallback(
    (colorKey: string) => {
      setDice((prev) => [...prev, { id: makeId(), colorKey, value: null }])
    },
    []
  )

  const removeDie = useCallback(
    (id: string) => {
      setDice((prev) => (prev.length <= 1 ? prev : prev.filter((d) => d.id !== id)))
    },
    []
  )

  const handleRolledValue = useCallback((id: string, value: number) => {
    setDice((prev) => prev.map((d) => (d.id === id ? { ...d, value } : d)))
  }, [])

  const rollAll = useCallback(() => {
    setRollTrigger((prev) => prev + 1)
  }, [])

  return (
    <div
      data-component="dice-tray"
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Dice area */}
      <div
        data-element="dice-area"
        style={{
          flex: 1,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '24px',
          padding: '24px',
          overflowY: 'auto',
          minHeight: 0,
        }}
      >
        {dice.map((die) => {
          const colorScheme = DICE_COLORS[die.colorKey]
          const faceColor = isDark ? colorScheme.faceDark : colorScheme.faceLight
          const isHovered = hoveredDie === die.id

          return (
            <div
              key={die.id}
              data-element="die-slot"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
                position: 'relative',
              }}
              onPointerEnter={() => setHoveredDie(die.id)}
              onPointerLeave={() => setHoveredDie(null)}
            >
              {/* Remove button */}
              {dice.length > 1 && isHovered && (
                <button
                  data-action="remove-die"
                  type="button"
                  onClick={() => removeDie(die.id)}
                  style={{
                    position: 'absolute',
                    top: -8,
                    right: -8,
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    border: 'none',
                    background: isDark ? 'rgba(239,68,68,0.8)' : 'rgba(239,68,68,0.9)',
                    color: 'white',
                    fontSize: '12px',
                    lineHeight: '20px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    zIndex: 2,
                    padding: 0,
                  }}
                >
                  x
                </button>
              )}

              <InteractiveDice
                onRoll={() => {}}
                size={80}
                colorScheme={colorScheme}
                onRolledValue={(value) => handleRolledValue(die.id, value)}
                rollTrigger={rollTrigger}
                title={`Roll ${die.colorKey} die`}
                perspective={perspective}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: 0,
                }}
              />

              {/* Value label */}
              <span
                data-element="die-value"
                style={{
                  fontSize: '1.25rem',
                  fontWeight: 700,
                  color: die.value !== null ? faceColor : (isDark ? 'rgba(107,114,128,0.5)' : 'rgba(156,163,175,0.5)'),
                  minHeight: '1.5em',
                  userSelect: 'none',
                }}
              >
                {die.value ?? '-'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Controls bar */}
      <div
        data-element="controls-bar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          borderTop: isDark
            ? '1px solid rgba(75,85,99,0.5)'
            : '1px solid rgba(209,213,219,0.8)',
          background: isDark ? 'rgba(17,24,39,0.6)' : 'rgba(255,255,255,0.6)',
        }}
      >
        {/* Color swatches to add dice */}
        <div
          data-element="color-swatches"
          style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}
        >
          {COLOR_KEYS.map((key) => {
            const scheme = DICE_COLORS[key]
            const bg = isDark ? scheme.faceDark : scheme.faceLight
            return (
              <button
                key={key}
                data-action={`add-${key}-die`}
                type="button"
                onClick={() => addDie(key)}
                title={`Add ${key} die`}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  border: isDark
                    ? '2px solid rgba(255,255,255,0.3)'
                    : '2px solid rgba(0,0,0,0.15)',
                  background: bg,
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'transform 0.15s ease',
                }}
                onPointerEnter={(e) => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'scale(1.2)'
                }}
                onPointerLeave={(e) => {
                  ;(e.currentTarget as HTMLElement).style.transform = 'scale(1)'
                }}
              />
            )
          })}
        </div>

        {/* Roll All + Sum */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            data-action="roll-all"
            type="button"
            onClick={rollAll}
            style={{
              padding: '8px 16px',
              borderRadius: '8px',
              border: 'none',
              background: isDark ? '#4f46e5' : '#4f46e5',
              color: 'white',
              fontWeight: 600,
              fontSize: '0.875rem',
              cursor: 'pointer',
              transition: 'opacity 0.15s ease',
            }}
            onPointerEnter={(e) => {
              ;(e.currentTarget as HTMLElement).style.opacity = '0.85'
            }}
            onPointerLeave={(e) => {
              ;(e.currentTarget as HTMLElement).style.opacity = '1'
            }}
          >
            Roll All
          </button>

          {hasValues && (
            <span
              data-element="sum-display"
              style={{
                fontSize: '1.125rem',
                fontWeight: 700,
                color: isDark ? 'rgba(209,213,219,1)' : 'rgba(55,65,81,1)',
                whiteSpace: 'nowrap',
              }}
            >
              Sum: {sum}
            </span>
          )}
        </div>
      </div>

      <ToyDebugPanel title="Dice">
        <DebugSlider label="Perspective" value={perspective} min={50} max={800} step={10} onChange={setPerspective} />
      </ToyDebugPanel>
    </div>
  )
}
