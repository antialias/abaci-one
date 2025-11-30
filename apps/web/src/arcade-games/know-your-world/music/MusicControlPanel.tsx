/**
 * Music Control Panel
 *
 * A dedicated panel for music controls positioned in the upper right.
 * Shows start/stop, volume, and a description of the current music.
 * Includes expandable debug view showing the Strudel pattern code.
 */

'use client'

import { useState } from 'react'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useMusic } from './MusicContext'

// Map temperature to descriptive text
function getTemperatureDescription(temp: string | null): string | null {
  if (!temp) return null
  switch (temp) {
    case 'on_fire':
    case 'hot':
      return 'intensifying'
    case 'warmer':
      return 'warming up'
    case 'colder':
      return 'cooling down'
    case 'cold':
    case 'freezing':
      return 'distant'
    default:
      return null
  }
}

// Map region IDs to country names for display
const regionNames: Record<string, string> = {
  // Europe
  fr: 'France',
  es: 'Spain',
  it: 'Italy',
  ie: 'Ireland',
  de: 'Germany',
  gr: 'Greece',
  ru: 'Russia',
  gb: 'United Kingdom',
  pt: 'Portugal',
  nl: 'Netherlands',
  // Asia
  jp: 'Japan',
  cn: 'China',
  in: 'India',
  kr: 'South Korea',
  th: 'Thailand',
  vn: 'Vietnam',
  // Americas
  br: 'Brazil',
  mx: 'Mexico',
  ar: 'Argentina',
  cu: 'Cuba',
  jm: 'Jamaica',
  // Africa
  ng: 'Nigeria',
  gh: 'Ghana',
  ke: 'Kenya',
  eg: 'Egypt',
  // Middle East
  tr: 'Turkey',
  sa: 'Saudi Arabia',
  ae: 'UAE',
  // Oceania
  au: 'Australia',
  nz: 'New Zealand',
  // USA states
  la: 'Louisiana',
  tn: 'Tennessee',
  tx: 'Texas',
  ny: 'New York',
  ca: 'California',
  hi: 'Hawaii',
}

export function MusicControlPanel() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const music = useMusic()
  const [isDebugExpanded, setIsDebugExpanded] = useState(false)

  // Build music description
  const buildDescription = (): string => {
    const parts: string[] = []

    // Base continent/region
    if (music.currentPresetName && music.currentPresetName !== 'Default') {
      parts.push(`${music.currentPresetName} style`)
    } else {
      parts.push('Adventure theme')
    }

    // Hyper-local hint
    if (music.isHintActive && music.hintRegionId) {
      const regionName = regionNames[music.hintRegionId.toLowerCase()] || music.hintRegionId
      parts.push(`with ${regionName} hint`)
    }

    // Temperature effect
    const tempDesc = getTemperatureDescription(music.currentTemperature)
    if (tempDesc) {
      parts.push(`(${tempDesc})`)
    }

    return parts.join(' ')
  }

  // Show minimal "Enable Music" button when not initialized
  const showEnableButton = !music.isInitialized && music.isMuted

  return (
    <div
      data-component="music-control-panel"
      className={css({
        position: 'absolute',
        top: { base: '130px', sm: '150px' },
        right: { base: '2', sm: '4' },
        zIndex: 50,
        padding: showEnableButton ? '2 3' : '3',
        bg: isDark ? 'gray.800/90' : 'white/90',
        backdropFilter: 'blur(12px)',
        border: '1px solid',
        borderColor: isDark ? 'gray.700' : 'gray.300',
        rounded: 'xl',
        shadow: 'lg',
        minWidth: showEnableButton ? '140px' : '200px',
        maxWidth: '320px',
      })}
    >
      {/* Show enable button when music not initialized */}
      {showEnableButton ? (
        <button
          onClick={() => music.enableMusic()}
          data-action="enable-music"
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '2',
            padding: '2 3',
            bg: isDark ? 'blue.600' : 'blue.500',
            color: 'white',
            rounded: 'lg',
            border: 'none',
            cursor: 'pointer',
            fontSize: 'sm',
            fontWeight: 'medium',
            width: '100%',
            justifyContent: 'center',
            transition: 'all 0.15s',
            _hover: {
              bg: isDark ? 'blue.500' : 'blue.600',
            },
          })}
        >
          <span>🎵</span>
          <span>Enable Music</span>
        </button>
      ) : (
        <>
          {/* Header with play/stop toggle */}
          <div
            data-element="panel-header"
            className={css({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '2',
            })}
          >
            <div className={css({ display: 'flex', alignItems: 'center', gap: '2' })}>
              <span className={css({ fontSize: 'lg' })}>{music.isPlaying ? '🎵' : '🔇'}</span>
              <span
                className={css({
                  fontSize: 'sm',
                  fontWeight: 'bold',
                  color: isDark ? 'gray.200' : 'gray.800',
                })}
              >
                Music
              </span>
            </div>

            {/* Play/Stop button */}
            <button
              onClick={async () => {
                if (music.isPlaying) {
                  music.disableMusic()
                } else {
                  await music.enableMusic()
                }
              }}
              data-action="toggle-music"
              className={css({
                padding: '1.5 3',
                fontSize: 'xs',
                fontWeight: 'medium',
                cursor: 'pointer',
                rounded: 'md',
                border: '1px solid',
                transition: 'all 0.15s',
                bg: music.isPlaying
                  ? isDark
                    ? 'red.900/50'
                    : 'red.100'
                  : isDark
                    ? 'green.900/50'
                    : 'green.100',
                color: music.isPlaying
                  ? isDark
                    ? 'red.300'
                    : 'red.700'
                  : isDark
                    ? 'green.300'
                    : 'green.700',
                borderColor: music.isPlaying
                  ? isDark
                    ? 'red.700'
                    : 'red.300'
                  : isDark
                    ? 'green.700'
                    : 'green.300',
                _hover: {
                  bg: music.isPlaying
                    ? isDark
                      ? 'red.800/50'
                      : 'red.200'
                    : isDark
                      ? 'green.800/50'
                      : 'green.200',
                },
              })}
            >
              {music.isPlaying ? 'Stop' : 'Play'}
            </button>
          </div>

          {/* Music description */}
          <div
            data-element="music-description"
            className={css({
              fontSize: 'xs',
              color: isDark ? 'gray.400' : 'gray.600',
              marginBottom: '3',
              lineHeight: '1.4',
            })}
          >
            {music.isPlaying ? buildDescription() : 'Music paused'}
          </div>

          {/* Volume control - using native range to avoid Radix Slider re-render issues */}
          <div
            data-element="volume-control"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              marginBottom: '2',
            })}
          >
            <span className={css({ fontSize: 'sm', opacity: 0.6 })}>🔈</span>
            <input
              type="range"
              data-element="volume-slider"
              value={music.volume}
              onChange={(e) => music.setVolume(parseFloat(e.target.value))}
              min={0}
              max={1}
              step={0.05}
              disabled={!music.isPlaying}
              className={css({
                flex: 1,
                height: '4px',
                appearance: 'none',
                bg: isDark ? 'gray.600' : 'gray.300',
                borderRadius: '9999px',
                cursor: music.isPlaying ? 'pointer' : 'not-allowed',
                opacity: music.isPlaying ? 1 : 0.5,
                '&::-webkit-slider-thumb': {
                  appearance: 'none',
                  width: '14px',
                  height: '14px',
                  bg: isDark ? 'blue.400' : 'blue.500',
                  borderRadius: '50%',
                  cursor: music.isPlaying ? 'pointer' : 'not-allowed',
                },
                '&::-moz-range-thumb': {
                  width: '14px',
                  height: '14px',
                  bg: isDark ? 'blue.400' : 'blue.500',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: music.isPlaying ? 'pointer' : 'not-allowed',
                },
                _focus: {
                  outline: 'none',
                },
              })}
            />
            <span className={css({ fontSize: 'sm', opacity: 0.6 })}>🔊</span>
            <span
              className={css({
                fontSize: 'xs',
                color: isDark ? 'gray.500' : 'gray.500',
                minWidth: '32px',
                textAlign: 'right',
              })}
            >
              {Math.round(music.volume * 100)}%
            </span>
          </div>

          {/* Debug toggle */}
          <button
            onClick={() => setIsDebugExpanded(!isDebugExpanded)}
            data-action="toggle-debug"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '1',
              padding: '1 2',
              fontSize: 'xs',
              color: isDark ? 'gray.500' : 'gray.500',
              bg: 'transparent',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              justifyContent: 'center',
              _hover: {
                color: isDark ? 'gray.400' : 'gray.600',
              },
            })}
          >
            <span>{isDebugExpanded ? '▼' : '▶'}</span>
            <span>Debug</span>
          </button>

          {/* Debug panel */}
          {isDebugExpanded && (
            <div
              data-element="debug-panel"
              className={css({
                marginTop: '2',
                padding: '2',
                bg: isDark ? 'gray.900' : 'gray.100',
                rounded: 'md',
                fontSize: 'xs',
              })}
            >
              {/* Status info */}
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '1 2',
                  marginBottom: '2',
                  color: isDark ? 'gray.400' : 'gray.600',
                })}
              >
                <span>Preset:</span>
                <span className={css({ color: isDark ? 'blue.400' : 'blue.600' })}>
                  {music.currentPresetId}
                </span>
                <span>Hint:</span>
                <span className={css({ color: isDark ? 'green.400' : 'green.600' })}>
                  {music.isHintActive ? music.hintRegionId : 'none'}
                </span>
                <span>Temp:</span>
                <span className={css({ color: isDark ? 'orange.400' : 'orange.600' })}>
                  {music.currentTemperature || 'neutral'}
                </span>
              </div>

              {/* Pattern code */}
              <div
                className={css({
                  bg: isDark ? 'gray.950' : 'white',
                  rounded: 'sm',
                  padding: '2',
                  maxHeight: '150px',
                  overflow: 'auto',
                })}
              >
                <pre
                  className={css({
                    fontFamily: 'mono',
                    fontSize: '10px',
                    lineHeight: '1.4',
                    color: isDark ? 'green.300' : 'green.700',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    margin: 0,
                  })}
                >
                  {music.currentPattern || '// No pattern loaded'}
                </pre>
              </div>

              {/* Copy button */}
              <button
                onClick={() => {
                  navigator.clipboard.writeText(music.currentPattern)
                }}
                data-action="copy-pattern"
                className={css({
                  marginTop: '2',
                  padding: '1 2',
                  fontSize: 'xs',
                  bg: isDark ? 'gray.700' : 'gray.200',
                  color: isDark ? 'gray.300' : 'gray.700',
                  rounded: 'sm',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: {
                    bg: isDark ? 'gray.600' : 'gray.300',
                  },
                })}
              >
                Copy to clipboard
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
