'use client'

import { useCallback, useMemo } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useKnowYourWorld } from '../Provider'
import { DrillDownMapSelector } from './DrillDownMapSelector'
import { ALL_REGION_SIZES, getFilteredMapDataBySizesSync } from '../maps'
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
        gameMode={state.gameMode}
        onGameModeChange={setMode}
        assistanceLevel={state.assistanceLevel}
        onAssistanceLevelChange={setAssistanceLevel}
      />

      {/* Start Button - centered at bottom */}
      <div
        data-element="start-button-container"
        className={css({
          position: 'absolute',
          bottom: { base: '2', sm: '4' },
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
        })}
      >
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
