'use client'

import { useCallback, useMemo } from 'react'
import * as Select from '@radix-ui/react-select'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'
import { DrillDownMapSelector } from './DrillDownMapSelector'
import { ALL_REGION_SIZES, ASSISTANCE_LEVELS, getFilteredMapDataBySizesSync } from '../maps'
import type { AssistanceLevelConfig } from '../maps'
import { CONTINENTS, type ContinentId } from '../continents'

// Generate feature badges for an assistance level
function getFeatureBadges(level: AssistanceLevelConfig): Array<{ label: string; icon: string }> {
  const badges: Array<{ label: string; icon: string }> = []

  if (level.hotColdEnabled) {
    badges.push({ label: 'Hot/cold', icon: '🔥' })
  }

  if (level.hintsMode === 'onRequest') {
    if (level.autoHintDefault) {
      badges.push({ label: 'Auto-hints', icon: '💡' })
    } else {
      badges.push({ label: 'Hints', icon: '💡' })
    }
  } else if (level.hintsMode === 'limited' && level.hintLimit) {
    badges.push({ label: `${level.hintLimit} hints`, icon: '💡' })
  }

  return badges
}

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
  const {
    state,
    startGame,
    setMap,
    setMode,
    setRegionSizes,
    setAssistanceLevel,
    setStudyDuration,
    setContinent,
  } = useKnowYourWorld()

  // Calculate region counts per size category
  const regionCountsBySize = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const size of ALL_REGION_SIZES) {
      try {
        const filteredData = getFilteredMapDataBySizesSync(
          state.selectedMap,
          state.selectedContinent,
          [size]
        )
        counts[size] = filteredData.regions.length
      } catch {
        counts[size] = 0
      }
    }
    return counts
  }, [state.selectedMap, state.selectedContinent])

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
  const selectedAssistance = ASSISTANCE_LEVELS.find((level) => level.id === state.assistanceLevel)

  // Calculate total region count for start button
  const totalRegionCount = useMemo(() => {
    return state.includeSizes.reduce((sum, size) => sum + (regionCountsBySize[size] || 0), 0)
  }, [state.includeSizes, regionCountsBySize])

  // Get context label for start button
  const contextLabel = useMemo(() => {
    if (state.selectedContinent !== 'all') {
      const continent = CONTINENTS.find((c) => c.id === state.selectedContinent)
      return continent?.name ?? 'World'
    }
    return state.selectedMap === 'usa' ? 'USA' : 'World'
  }, [state.selectedContinent, state.selectedMap])

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
          includeSizes={state.includeSizes}
          onRegionSizesChange={setRegionSizes}
          regionCountsBySize={regionCountsBySize}
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

        {/* Assistance Level */}
        <div
          data-setting="assistance-level"
          className={css({ display: 'flex', flexDirection: 'column' })}
        >
          <label className={labelStyles}>Assistance</label>
          <Select.Root
            value={state.assistanceLevel}
            onValueChange={(value) =>
              setAssistanceLevel(value as 'guided' | 'helpful' | 'standard' | 'none')
            }
          >
            <Select.Trigger className={triggerStyles}>
              <span className={css({ fontSize: '2xl' })}>{selectedAssistance?.emoji || '💡'}</span>
              <div className={css({ flex: 1, textAlign: 'left' })}>
                <div
                  className={css({
                    fontWeight: '600',
                    color: isDark ? 'gray.100' : 'gray.900',
                    fontSize: 'sm',
                  })}
                >
                  {selectedAssistance?.label}
                </div>
                <div
                  className={css({
                    fontSize: 'xs',
                    color: isDark ? 'gray.400' : 'gray.500',
                    lineHeight: 'tight',
                  })}
                >
                  {selectedAssistance?.description}
                </div>
                {/* Feature badges */}
                {selectedAssistance && (
                  <div
                    className={css({
                      display: 'flex',
                      gap: '1',
                      marginTop: '1',
                      flexWrap: 'wrap',
                    })}
                  >
                    {getFeatureBadges(selectedAssistance).map((badge) => (
                      <span
                        key={badge.label}
                        className={css({
                          fontSize: '2xs',
                          padding: '0.5 1',
                          bg: isDark ? 'gray.700' : 'gray.200',
                          color: isDark ? 'gray.300' : 'gray.600',
                          rounded: 'sm',
                        })}
                      >
                        {badge.icon} {badge.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <Select.Icon className={css({ color: isDark ? 'gray.400' : 'gray.500' })}>
                ▼
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content className={contentStyles} position="popper" sideOffset={5}>
                <Select.Viewport>
                  {ASSISTANCE_LEVELS.map((level) => {
                    const badges = getFeatureBadges(level)
                    return (
                      <Select.Item key={level.id} value={level.id} className={itemStyles}>
                        <span className={css({ fontSize: '2xl' })}>{level.emoji}</span>
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
                            {level.description}
                          </div>
                          {/* Feature badges */}
                          <div
                            className={css({
                              display: 'flex',
                              gap: '1',
                              marginTop: '1',
                              flexWrap: 'wrap',
                            })}
                          >
                            {badges.map((badge) => (
                              <span
                                key={badge.label}
                                className={css({
                                  fontSize: '2xs',
                                  padding: '0.5 1',
                                  bg: isDark ? 'gray.700' : 'gray.200',
                                  color: isDark ? 'gray.300' : 'gray.600',
                                  rounded: 'sm',
                                })}
                              >
                                {badge.icon} {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>
                      </Select.Item>
                    )
                  })}
                </Select.Viewport>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

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

      {/* Start Game Button */}
      <button
        data-action="start-game"
        onClick={startGame}
        className={css({
          width: '100%',
          padding: '4',
          fontSize: 'xl',
          fontWeight: 'bold',
          bg: 'blue.600',
          color: 'white',
          rounded: '2xl',
          cursor: 'pointer',
          boxShadow: 'lg',
          transition: 'all 0.2s',
          _hover: {
            bg: 'blue.700',
            transform: 'scale(1.02)',
          },
          _active: {
            transform: 'scale(0.98)',
          },
        })}
      >
        ▶ Start Game ({contextLabel} - {totalRegionCount}{' '}
        {totalRegionCount === 1 ? 'region' : 'regions'})
      </button>
    </div>
  )
}
