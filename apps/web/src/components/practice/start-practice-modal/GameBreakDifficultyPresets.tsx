'use client'

import { useTheme } from '@/contexts/ThemeContext'
import { css } from '../../../../styled-system/css'
import { useStartPracticeModal, type GameBreakDifficultyPreset } from '../StartPracticeModalContext'

const PRESETS: {
  key: GameBreakDifficultyPreset
  label: string
  emoji: string
}[] = [
  { key: 'easy', label: 'Easy', emoji: '🌱' },
  { key: 'medium', label: 'Medium', emoji: '🌿' },
  { key: 'hard', label: 'Hard', emoji: '🌳' },
]

/**
 * Difficulty preset selector for game break configuration.
 * Shows Easy/Medium/Hard buttons when a specific game is selected.
 */
export function GameBreakDifficultyPresets() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const {
    gameBreakSelectedGame,
    selectedGamePracticeConfig,
    gameBreakDifficultyPreset,
    setGameBreakDifficultyPreset,
    gameBreakShowCustomize,
  } = useStartPracticeModal()

  // Don't show if random or no game selected
  if (!gameBreakSelectedGame || gameBreakSelectedGame === 'random') {
    return null
  }

  // Don't show if game has no practice break config
  if (!selectedGamePracticeConfig) {
    return null
  }

  // Don't show if game has no difficulty presets
  const presets = selectedGamePracticeConfig.difficultyPresets
  if (!presets || Object.keys(presets).length === 0) {
    return null
  }

  // Don't show preset selector when customize view is active
  if (gameBreakShowCustomize) {
    return null
  }

  // Filter to only show presets that exist in the config
  const availablePresets = PRESETS.filter((p) => p.key && presets[p.key])

  if (availablePresets.length === 0) {
    return null
  }

  return (
    <div
      data-element="game-break-difficulty"
      className={css({
        display: 'flex',
        gap: '0.25rem',
        marginTop: '0.375rem',
      })}
    >
      {availablePresets.map(({ key, label, emoji }) => {
        const isSelected = gameBreakDifficultyPreset === key
        return (
          <button
            key={key}
            type="button"
            data-option={`difficulty-${key}`}
            data-selected={isSelected}
            onClick={() => setGameBreakDifficultyPreset(key)}
            className={css({
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem',
              padding: '0.375rem 0.5rem',
              fontSize: '0.6875rem',
              fontWeight: '600',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              '@media (max-width: 480px), (max-height: 700px)': {
                padding: '0.25rem 0.375rem',
                fontSize: '0.5625rem',
                gap: '0.125rem',
              },
            })}
            style={{
              backgroundColor: isSelected
                ? isDark
                  ? 'rgba(34, 197, 94, 0.25)'
                  : 'rgba(34, 197, 94, 0.15)'
                : isDark
                  ? 'rgba(34, 197, 94, 0.1)'
                  : 'rgba(34, 197, 94, 0.08)',
              color: isSelected ? (isDark ? '#86efac' : '#16a34a') : isDark ? '#4ade80' : '#22c55e',
              boxShadow: isSelected
                ? isDark
                  ? '0 0 10px rgba(34, 197, 94, 0.3)'
                  : '0 0 10px rgba(34, 197, 94, 0.2)'
                : 'none',
            }}
          >
            <span>{emoji}</span>
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}
