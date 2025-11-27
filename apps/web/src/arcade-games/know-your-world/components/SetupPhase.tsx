'use client'

import { useCallback } from 'react'
import * as Select from '@radix-ui/react-select'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'
import { DrillDownMapSelector } from './DrillDownMapSelector'
import { WORLD_MAP, USA_MAP, DEFAULT_DIFFICULTY_CONFIG } from '../maps'
import type { ContinentId } from '../continents'

// Game mode options with rich descriptions
const GAME_MODE_OPTIONS = [
  {
    value: 'cooperative' as const,
    emoji: '🤝',
    label: 'Cooperative',
    description: 'Work together to find all regions',
  },
  {
    value: 'race' as const,
    emoji: '🏁',
    label: 'Race',
    description: 'First to click the correct region wins',
  },
  {
    value: 'turn-based' as const,
    emoji: '↔️',
    label: 'Turn-Based',
    description: 'Take turns finding regions',
  },
]

// Study time options with rich descriptions
const STUDY_TIME_OPTIONS = [
  {
    value: 0 as const,
    emoji: '⏭️',
    label: 'Skip',
    description: 'Jump straight into the game',
  },
  {
    value: 30 as const,
    emoji: '⏱️',
    label: '30 seconds',
    description: 'Quick review before playing',
  },
  {
    value: 60 as const,
    emoji: '⏲️',
    label: '1 minute',
    description: 'Moderate study time',
  },
  {
    value: 120 as const,
    emoji: '⏰',
    label: '2 minutes',
    description: 'Extended study period',
  },
]

export function SetupPhase() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, startGame, setMap, setMode, setDifficulty, setStudyDuration, setContinent } =
    useKnowYourWorld()

  // Get difficulty config for current map
  const mapData = state.selectedMap === 'world' ? WORLD_MAP : USA_MAP
  const difficultyConfig = mapData.difficultyConfig || DEFAULT_DIFFICULTY_CONFIG

  // Handle selection change from drill-down selector
  const handleSelectionChange = useCallback(
    (mapId: 'world' | 'usa', continentId: ContinentId | 'all') => {
      setMap(mapId)
      setContinent(continentId)
    },
    [setMap, setContinent]
  )

  // Get selected options for display
  const selectedMode = GAME_MODE_OPTIONS.find((opt) => opt.value === state.gameMode)
  const selectedStudyTime = STUDY_TIME_OPTIONS.find((opt) => opt.value === state.studyDuration)
  const selectedDifficulty = difficultyConfig.levels.find((level) => level.id === state.difficulty)

  // Styles for Radix Select components
  const triggerStyles = css({
    display: 'flex',
    alignItems: 'center',
    gap: '3',
    padding: '3',
    bg: isDark ? 'gray.800' : 'white',
    border: '2px solid',
    borderColor: isDark ? 'gray.600' : 'gray.300',
    rounded: 'xl',
    cursor: 'pointer',
    width: '100%', // Fill grid cell
    transition: 'all 0.15s',
    _hover: {
      borderColor: isDark ? 'blue.500' : 'blue.400',
      bg: isDark ? 'gray.750' : 'gray.50',
    },
    _focus: {
      outline: 'none',
      borderColor: 'blue.500',
      boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.2)',
    },
  })

  const contentStyles = css({
    bg: isDark ? 'gray.800' : 'white',
    border: '2px solid',
    borderColor: isDark ? 'gray.600' : 'gray.200',
    rounded: 'xl',
    shadow: 'xl',
    overflow: 'hidden',
    zIndex: 1000,
    minWidth: '220px',
  })

  const itemStyles = css({
    display: 'flex',
    alignItems: 'center',
    gap: '3',
    padding: '3',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.1s',
    _hover: {
      bg: isDark ? 'gray.700' : 'blue.50',
    },
    '&[data-state="checked"]': {
      bg: isDark ? 'blue.900/50' : 'blue.100',
    },
  })

  const labelStyles = css({
    fontSize: 'xs',
    fontWeight: '600',
    color: isDark ? 'gray.400' : 'gray.500',
    marginBottom: '2',
    textTransform: 'uppercase',
    letterSpacing: 'wide',
  })

  return (
    <div
      data-component="setup-phase"
      className={css({
        display: 'flex',
        flexDirection: 'column',
        gap: '4',
        maxWidth: '800px',
        margin: '0 auto',
        paddingTop: '16',
        paddingX: '4',
        paddingBottom: '6',
      })}
    >
      {/* Header */}
      <div
        data-element="header"
        className={css({
          textAlign: 'center',
          marginBottom: '2',
        })}
      >
        <h1
          className={css({
            fontSize: '2xl',
            fontWeight: 'bold',
            color: isDark ? 'gray.100' : 'gray.900',
          })}
        >
          Know Your World 🌍
        </h1>
        <p
          className={css({
            fontSize: 'sm',
            color: isDark ? 'gray.400' : 'gray.600',
            marginTop: '1',
          })}
        >
          Click continents to zoom in, or start playing from any level
        </p>
      </div>

      {/* Drill-Down Map Selector */}
      <div data-section="map-selection">
        <DrillDownMapSelector
          selectedMap={state.selectedMap}
          selectedContinent={state.selectedContinent}
          onSelectionChange={handleSelectionChange}
          onStartGame={startGame}
        />
      </div>

      {/* Settings Row with Radix Selects */}
      <div
        data-section="settings"
        className={css({
          display: 'grid',
          gridTemplateColumns: '1fr', // Stack on mobile
          gap: '4',
          padding: '5',
          bg: isDark ? 'gray.800/50' : 'gray.50',
          rounded: '2xl',
          border: '1px solid',
          borderColor: isDark ? 'gray.700' : 'gray.200',
          md: {
            gridTemplateColumns: 'repeat(3, 1fr)', // 3 columns on desktop
          },
        })}
      >
        {/* Game Mode */}
        <div data-setting="game-mode" className={css({ display: 'flex', flexDirection: 'column' })}>
          <label className={labelStyles}>Mode</label>
          <Select.Root
            value={state.gameMode}
            onValueChange={(value) => setMode(value as 'cooperative' | 'race' | 'turn-based')}
          >
            <Select.Trigger className={triggerStyles}>
              <span className={css({ fontSize: '2xl' })}>{selectedMode?.emoji}</span>
              <div className={css({ flex: 1, textAlign: 'left' })}>
                <div
                  className={css({
                    fontWeight: '600',
                    color: isDark ? 'gray.100' : 'gray.900',
                    fontSize: 'sm',
                  })}
                >
                  {selectedMode?.label}
                </div>
                <div
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'gray.400' : 'gray.500',
                    lineHeight: 'tight',
                  })}
                >
                  {selectedMode?.description}
                </div>
              </div>
              <Select.Icon className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>
                ▼
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className={contentStyles} position="popper" sideOffset={5}>
                <Select.Viewport>
                  {GAME_MODE_OPTIONS.map((option) => (
                    <Select.Item key={option.value} value={option.value} className={itemStyles}>
                      <span className={css({ fontSize: '2xl' })}>{option.emoji}</span>
                      <div className={css({ flex: 1 })}>
                        <Select.ItemText>
                          <span
                            className={css({
                              fontWeight: '600',
                              color: isDark ? 'gray.100' : 'gray.900',
                              fontSize: 'sm',
                            })}
                          >
                            {option.label}
                          </span>
                        </Select.ItemText>
                        <div
                          className={css({
                            fontSize: 'xs',
                            color: isDark ? 'gray.400' : 'gray.500',
                            lineHeight: 'tight',
                          })}
                        >
                          {option.description}
                        </div>
                      </div>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Difficulty (only show if multiple levels) */}
        {difficultyConfig.levels.length > 1 && (
          <div
            data-setting="difficulty"
            className={css({ display: 'flex', flexDirection: 'column' })}
          >
            <label className={labelStyles}>Difficulty</label>
            <Select.Root value={state.difficulty} onValueChange={setDifficulty}>
              <Select.Trigger className={triggerStyles}>
                <span className={css({ fontSize: '2xl' })}>
                  {selectedDifficulty?.emoji || '🎯'}
                </span>
                <div className={css({ flex: 1, textAlign: 'left' })}>
                  <div
                    className={css({
                      fontWeight: '600',
                      color: isDark ? 'gray.100' : 'gray.900',
                      fontSize: 'sm',
                    })}
                  >
                    {selectedDifficulty?.label}
                  </div>
                  <div
                    className={css({
                      fontSize: 'xs',
                      color: isDark ? 'gray.400' : 'gray.500',
                      lineHeight: 'tight',
                    })}
                  >
                    {selectedDifficulty?.description || 'Select difficulty level'}
                  </div>
                </div>
                <Select.Icon className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>
                  ▼
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content className={contentStyles} position="popper" sideOffset={5}>
                  <Select.Viewport>
                    {difficultyConfig.levels.map((level) => (
                      <Select.Item key={level.id} value={level.id} className={itemStyles}>
                        <span className={css({ fontSize: '2xl' })}>{level.emoji || '🎯'}</span>
                        <div className={css({ flex: 1 })}>
                          <Select.ItemText>
                            <span
                              className={css({
                                fontWeight: '600',
                                color: isDark ? 'gray.100' : 'gray.900',
                                fontSize: 'sm',
                              })}
                            >
                              {level.label}
                            </span>
                          </Select.ItemText>
                          <div
                            className={css({
                              fontSize: 'xs',
                              color: isDark ? 'gray.400' : 'gray.500',
                              lineHeight: 'tight',
                            })}
                          >
                            {level.description || `${level.label} difficulty`}
                          </div>
                        </div>
                      </Select.Item>
                    ))}
                  </Select.Viewport>
                </Select.Content>
              </Select.Portal>
            </Select.Root>
          </div>
        )}

        {/* Study Duration */}
        <div
          data-setting="study-duration"
          className={css({ display: 'flex', flexDirection: 'column' })}
        >
          <label className={labelStyles}>Study Time</label>
          <Select.Root
            value={String(state.studyDuration)}
            onValueChange={(value) => setStudyDuration(Number(value) as 0 | 30 | 60 | 120)}
          >
            <Select.Trigger className={triggerStyles}>
              <span className={css({ fontSize: '2xl' })}>{selectedStudyTime?.emoji}</span>
              <div className={css({ flex: 1, textAlign: 'left' })}>
                <div
                  className={css({
                    fontWeight: '600',
                    color: isDark ? 'gray.100' : 'gray.900',
                    fontSize: 'sm',
                  })}
                >
                  {selectedStudyTime?.label}
                </div>
                <div
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'gray.400' : 'gray.500',
                    lineHeight: 'tight',
                  })}
                >
                  {selectedStudyTime?.description}
                </div>
              </div>
              <Select.Icon className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>
                ▼
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className={contentStyles} position="popper" sideOffset={5}>
                <Select.Viewport>
                  {STUDY_TIME_OPTIONS.map((option) => (
                    <Select.Item
                      key={option.value}
                      value={String(option.value)}
                      className={itemStyles}
                    >
                      <span className={css({ fontSize: '2xl' })}>{option.emoji}</span>
                      <div className={css({ flex: 1 })}>
                        <Select.ItemText>
                          <span
                            className={css({
                              fontWeight: '600',
                              color: isDark ? 'gray.100' : 'gray.900',
                              fontSize: 'sm',
                            })}
                          >
                            {option.label}
                          </span>
                        </Select.ItemText>
                        <div
                          className={css({
                            fontSize: 'xs',
                            color: isDark ? 'gray.400' : 'gray.500',
                            lineHeight: 'tight',
                          })}
                        >
                          {option.description}
                        </div>
                      </div>
                    </Select.Item>
                  ))}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>
      </div>

      {/* Tips Section */}
      <div
        data-element="tips"
        className={css({
          padding: '3',
          bg: isDark ? 'gray.800/30' : 'gray.100/30',
          rounded: 'lg',
          fontSize: 'sm',
          color: isDark ? 'gray.400' : 'gray.600',
          textAlign: 'center',
        })}
      >
        <strong>Tip:</strong> Press G or click "Give Up" to skip a region you don't know.{' '}
        {state.difficulty === 'easy'
          ? 'On Easy, skipped regions are re-asked after a few turns.'
          : 'On Hard, skipped regions are re-asked at the end.'}
      </div>
    </div>
  )
}
