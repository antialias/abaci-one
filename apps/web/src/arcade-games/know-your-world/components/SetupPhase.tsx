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

// Travel-themed content for each region
interface RegionTheme {
  gradient: string
  gradientHover: string
  icons: string[] // Decorative icons to show
  actionText: string // "Let's explore!" / "Bon voyage!" etc.
  flagEmojis: string[] // Representative flag emojis
}

const REGION_THEMES: Record<string, RegionTheme> = {
  World: {
    gradient: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)',
    gradientHover: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 50%, #22d3ee 100%)',
    icons: ['✈️', '🌍', '🌎', '🌏'],
    actionText: 'Start World Tour!',
    flagEmojis: ['🇫🇷', '🇯🇵', '🇧🇷', '🇦🇺', '🇿🇦'],
  },
  USA: {
    gradient: 'linear-gradient(135deg, #dc2626 0%, #1d4ed8 100%)',
    gradientHover: 'linear-gradient(135deg, #ef4444 0%, #3b82f6 100%)',
    icons: ['🗽', '🦅', '🇺🇸'],
    actionText: 'Start USA Tour!',
    flagEmojis: ['🇺🇸'],
  },
  Africa: {
    gradient: 'linear-gradient(135deg, #d97706 0%, #059669 100%)',
    gradientHover: 'linear-gradient(135deg, #f59e0b 0%, #10b981 100%)',
    icons: ['🦁', '🌍', '🐘'],
    actionText: 'Start Safari!',
    flagEmojis: ['🇿🇦', '🇰🇪', '🇪🇬', '🇳🇬', '🇲🇦'],
  },
  Asia: {
    gradient: 'linear-gradient(135deg, #dc2626 0%, #f59e0b 100%)',
    gradientHover: 'linear-gradient(135deg, #ef4444 0%, #fbbf24 100%)',
    icons: ['🏯', '🌏', '🐉'],
    actionText: 'Start Journey!',
    flagEmojis: ['🇯🇵', '🇨🇳', '🇮🇳', '🇰🇷', '🇹🇭'],
  },
  Europe: {
    gradient: 'linear-gradient(135deg, #1d4ed8 0%, #7c3aed 100%)',
    gradientHover: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    icons: ['🏰', '🌍', '🗼'],
    actionText: 'Start Voyage!',
    flagEmojis: ['🇫🇷', '🇩🇪', '🇮🇹', '🇪🇸', '🇬🇧'],
  },
  'North America': {
    gradient: 'linear-gradient(135deg, #059669 0%, #0891b2 100%)',
    gradientHover: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
    icons: ['🗽', '🌎', '🍁'],
    actionText: 'Start Exploring!',
    flagEmojis: ['🇺🇸', '🇨🇦', '🇲🇽'],
  },
  Oceania: {
    gradient: 'linear-gradient(135deg, #0891b2 0%, #059669 100%)',
    gradientHover: 'linear-gradient(135deg, #06b6d4 0%, #10b981 100%)',
    icons: ['🦘', '🌏', '🏝️'],
    actionText: 'Start Adventure!',
    flagEmojis: ['🇦🇺', '🇳🇿', '🇫🇯'],
  },
  'South America': {
    gradient: 'linear-gradient(135deg, #059669 0%, #d97706 100%)',
    gradientHover: 'linear-gradient(135deg, #10b981 0%, #f59e0b 100%)',
    icons: ['🗿', '🌎', '🌴'],
    actionText: 'Start Expedition!',
    flagEmojis: ['🇧🇷', '🇦🇷', '🇨🇴', '🇵🇪', '🇨🇱'],
  },
}

const DEFAULT_THEME: RegionTheme = REGION_THEMES.World

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

// Game mode options
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

export function SetupPhase() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const { state, startGame, setMap, setMode, setRegionSizes, setAssistanceLevel, setContinent } =
    useKnowYourWorld()

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
  const selectedAssistance = ASSISTANCE_LEVELS.find((level) => level.id === state.assistanceLevel)
  const selectedAssistanceBadges = selectedAssistance ? getFeatureBadges(selectedAssistance) : []

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

  // Get travel theme for current region
  const regionTheme = useMemo(() => {
    return REGION_THEMES[contextLabel] ?? DEFAULT_THEME
  }, [contextLabel])

  // Card trigger styles - responsive dimensions
  const cardTriggerStyles = css({
    display: 'flex',
    alignItems: 'center',
    gap: { base: '1.5', sm: '3' },
    padding: { base: '1.5', sm: '3' },
    bg: isDark ? 'gray.700/80' : 'white/80',
    rounded: 'xl',
    cursor: 'pointer',
    transition: 'all 0.15s',
    width: { base: 'calc(50% - 4px)', sm: '260px' },
    height: { base: '48px', sm: '88px' },
    textAlign: 'left',
    _hover: {
      bg: isDark ? 'gray.600/90' : 'white',
    },
    _focus: {
      outline: 'none',
      ring: '2px solid',
      ringColor: 'blue.500',
    },
  })

  const contentStyles = css({
    bg: isDark ? 'gray.800' : 'white',
    border: '1px solid',
    borderColor: isDark ? 'gray.600' : 'gray.200',
    rounded: 'xl',
    shadow: 'xl',
    overflow: 'hidden',
    zIndex: 1000,
    minWidth: '280px',
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

  return (
    <div
      data-component="setup-phase"
      className={css({
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        overflow: 'hidden',
        zIndex: 0,
      })}
    >
      {/* Full-viewport Map - fills entire container */}
      <DrillDownMapSelector
        selectedMap={state.selectedMap}
        selectedContinent={state.selectedContinent}
        onSelectionChange={handleSelectionChange}
        onStartGame={startGame}
        includeSizes={state.includeSizes}
        onRegionSizesChange={setRegionSizes}
        regionCountsBySize={regionCountsBySize}
        fillContainer
      />

      {/* Game Setup Sequence - Mode → Guidance → Start */}
      <div
        data-element="setup-sequence"
        className={css({
          position: 'absolute',
          bottom: { base: '2', sm: '4' },
          left: { base: '2', sm: '50%' },
          right: { base: '2', sm: 'auto' },
          transform: { base: 'none', sm: 'translateX(-50%)' },
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'stretch',
          gap: '2',
          padding: '2',
          bg: isDark ? 'gray.800/95' : 'gray.100/95',
          backdropFilter: 'blur(12px)',
          rounded: '2xl',
          shadow: 'xl',
          zIndex: 50,
          maxWidth: { base: '100%', sm: 'fit-content' },
        })}
      >
        {/* Game Mode Selector */}
        <Select.Root
          value={state.gameMode}
          onValueChange={(value) => setMode(value as 'cooperative' | 'race' | 'turn-based')}
        >
          <Select.Trigger className={cardTriggerStyles}>
            <span
              className={css({
                fontSize: { base: 'lg', sm: '2xl' },
                flexShrink: 0,
              })}
            >
              {selectedMode?.emoji}
            </span>
            <div className={css({ flex: 1, minWidth: 0 })}>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: { base: '1', sm: '2' },
                })}
              >
                <span
                  className={css({
                    fontWeight: '600',
                    fontSize: { base: 'sm', sm: 'md' },
                    color: isDark ? 'gray.100' : 'gray.800',
                  })}
                >
                  {selectedMode?.label}
                </span>
                <Select.Icon
                  className={css({
                    color: isDark ? 'gray.400' : 'gray.500',
                    fontSize: 'xs',
                  })}
                >
                  ▼
                </Select.Icon>
              </div>
              <div
                className={css({
                  fontSize: 'xs',
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginTop: '0.5',
                  lineHeight: 'tight',
                  display: { base: 'none', sm: 'block' },
                })}
              >
                {selectedMode?.description}
              </div>
            </div>
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
                            fontSize: 'md',
                            color: isDark ? 'gray.100' : 'gray.900',
                          })}
                        >
                          {option.label}
                        </span>
                      </Select.ItemText>
                      <div
                        className={css({
                          fontSize: 'sm',
                          color: isDark ? 'gray.400' : 'gray.500',
                          marginTop: '1',
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

        {/* Assistance Level Selector */}
        <Select.Root
          value={state.assistanceLevel}
          onValueChange={(value) =>
            setAssistanceLevel(value as 'guided' | 'helpful' | 'standard' | 'none')
          }
        >
          <Select.Trigger className={cardTriggerStyles}>
            <span
              className={css({
                fontSize: { base: 'lg', sm: '2xl' },
                flexShrink: 0,
              })}
            >
              {selectedAssistance?.emoji || '💡'}
            </span>
            <div className={css({ flex: 1, minWidth: 0 })}>
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: { base: '1', sm: '2' },
                })}
              >
                <span
                  className={css({
                    fontWeight: '600',
                    fontSize: { base: 'sm', sm: 'md' },
                    color: isDark ? 'gray.100' : 'gray.800',
                  })}
                >
                  {selectedAssistance?.label}
                </span>
                <Select.Icon
                  className={css({
                    color: isDark ? 'gray.400' : 'gray.500',
                    fontSize: 'xs',
                  })}
                >
                  ▼
                </Select.Icon>
              </div>
              <div
                className={css({
                  fontSize: 'xs',
                  color: isDark ? 'gray.400' : 'gray.500',
                  marginTop: '0.5',
                  lineHeight: 'tight',
                  display: { base: 'none', sm: 'block' },
                })}
              >
                {selectedAssistance?.description}
              </div>
              {selectedAssistanceBadges.length > 0 && (
                <div
                  className={css({
                    display: { base: 'none', sm: 'flex' },
                    gap: '1',
                    mt: '1.5',
                    flexWrap: 'wrap',
                  })}
                >
                  {selectedAssistanceBadges.map((badge) => (
                    <span
                      key={badge.label}
                      className={css({
                        fontSize: '2xs',
                        padding: '0.5 1.5',
                        bg: isDark ? 'gray.600' : 'gray.300',
                        color: isDark ? 'gray.300' : 'gray.700',
                        rounded: 'full',
                      })}
                    >
                      {badge.icon} {badge.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
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
                              fontSize: 'md',
                              color: isDark ? 'gray.100' : 'gray.900',
                            })}
                          >
                            {level.label}
                          </span>
                        </Select.ItemText>
                        <div
                          className={css({
                            fontSize: 'sm',
                            color: isDark ? 'gray.400' : 'gray.500',
                            marginTop: '1',
                          })}
                        >
                          {level.description}
                        </div>
                        {badges.length > 0 && (
                          <div
                            className={css({
                              display: 'flex',
                              gap: '1',
                              mt: '2',
                              flexWrap: 'wrap',
                            })}
                          >
                            {badges.map((badge) => (
                              <span
                                key={badge.label}
                                className={css({
                                  fontSize: 'xs',
                                  padding: '1 2',
                                  bg: isDark ? 'gray.600' : 'gray.200',
                                  color: isDark ? 'gray.300' : 'gray.600',
                                  rounded: 'md',
                                })}
                              >
                                {badge.icon} {badge.label}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </Select.Item>
                  )
                })}
              </Select.Viewport>
            </Select.Content>
          </Select.Portal>
        </Select.Root>

        {/* Start Button - Travel-themed, region-specific */}
        <button
          data-action="start-game"
          onClick={startGame}
          className={css({
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: { base: '2', sm: '3' },
            padding: { base: '2 4', sm: '3 5' },
            width: { base: '100%', sm: 'auto' },
            minWidth: { base: 'auto', sm: '220px' },
            flex: { base: 'none', sm: 1 },
            height: { base: '56px', sm: '88px' },
            fontSize: { base: 'md', sm: 'lg' },
            fontWeight: 'bold',
            color: 'white',
            rounded: 'xl',
            cursor: 'pointer',
            transition: 'all 0.2s ease-out',
            overflow: 'hidden',
            border: '2px solid rgba(255,255,255,0.2)',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            _hover: {
              transform: 'scale(1.02)',
              boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
            },
            _active: {
              transform: 'scale(0.98)',
            },
          })}
          style={{
            background: regionTheme.gradient,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = regionTheme.gradientHover
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = regionTheme.gradient
          }}
        >
          {/* Decorative flag strip at top */}
          <div
            className={css({
              position: 'absolute',
              top: '0',
              left: '0',
              right: '0',
              height: { base: '16px', sm: '20px' },
              display: 'flex',
              justifyContent: 'center',
              gap: '1',
              fontSize: { base: '2xs', sm: 'xs' },
              bg: 'rgba(0,0,0,0.15)',
              paddingTop: '1px',
              overflow: 'hidden',
            })}
          >
            {regionTheme.flagEmojis.map((flag, i) => (
              <span key={i} className={css({ opacity: 0.9 })}>
                {flag}
              </span>
            ))}
          </div>

          {/* Main content */}
          <div
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: { base: '2', sm: '3' },
              marginTop: { base: '6px', sm: '8px' },
            })}
          >
            {/* Travel icons */}
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                fontSize: { base: 'lg', sm: '2xl' },
                lineHeight: 1,
              })}
            >
              <span>{regionTheme.icons[0]}</span>
              <span
                className={css({
                  fontSize: { base: 'xs', sm: 'sm' },
                  marginTop: '-2px',
                })}
              >
                {regionTheme.icons[1]}
              </span>
            </div>

            {/* Text content */}
            <div
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
              })}
            >
              <span
                className={css({
                  fontSize: { base: 'md', sm: 'lg' },
                  fontWeight: 'bold',
                  textShadow: '0 1px 2px rgba(0,0,0,0.2)',
                })}
              >
                Start {contextLabel}
              </span>
              <span
                className={css({
                  fontSize: { base: 'xs', sm: 'sm' },
                  fontWeight: 'normal',
                  opacity: 0.9,
                })}
              >
                {totalRegionCount} regions
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
