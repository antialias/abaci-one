/**
 * Music Control Modal
 *
 * A modal dialog for music controls accessible from the guidance menu.
 * Shows play/stop, volume, and optionally debug info.
 */

'use client'

import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { css } from '@styled/css'
import { useTheme } from '@/contexts/ThemeContext'
import { useMusic } from './MusicContext'

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

interface MusicControlModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MusicControlModal({ open, onOpenChange }: MusicControlModalProps) {
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

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          data-element="music-modal-overlay"
          className={css({
            position: 'fixed',
            inset: '0',
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            zIndex: 9998,
            animation: 'fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1)',
          })}
        />
        <Dialog.Content
          data-component="music-control-modal"
          className={css({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            bg: isDark ? 'gray.800' : 'white',
            borderRadius: 'xl',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            padding: '5',
            width: '90vw',
            maxWidth: '360px',
            maxHeight: '85vh',
            overflow: 'auto',
            zIndex: 9999,
            animation: 'contentShow 150ms cubic-bezier(0.16, 1, 0.3, 1)',
            border: '1px solid',
            borderColor: isDark ? 'gray.700' : 'gray.200',
          })}
        >
          <Dialog.Title
            className={css({
              fontSize: 'lg',
              fontWeight: 'bold',
              marginBottom: '4',
              display: 'flex',
              alignItems: 'center',
              gap: '2',
              color: isDark ? 'gray.100' : 'gray.900',
            })}
          >
            <span>🎵</span>
            Music Controls
          </Dialog.Title>

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
              width: '100%',
              padding: '3',
              fontSize: 'md',
              fontWeight: 'medium',
              cursor: 'pointer',
              rounded: 'lg',
              border: '2px solid',
              transition: 'all 0.15s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '2',
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
            <span>{music.isPlaying ? '⏹️' : '▶️'}</span>
            <span>
              {music.isPlaying ? 'Stop Music' : music.isInitialized ? 'Play Music' : 'Enable Music'}
            </span>
          </button>

          {/* Music description */}
          <div
            data-element="music-description"
            className={css({
              fontSize: 'sm',
              color: isDark ? 'gray.400' : 'gray.600',
              marginTop: '3',
              marginBottom: '4',
              textAlign: 'center',
            })}
          >
            {music.isPlaying ? buildDescription() : 'Music paused'}
          </div>

          {/* Volume control */}
          <div
            data-element="volume-control"
            className={css({
              display: 'flex',
              alignItems: 'center',
              gap: '3',
              padding: '3',
              bg: isDark ? 'gray.900/50' : 'gray.100',
              rounded: 'lg',
            })}
          >
            <span className={css({ fontSize: 'lg' })}>🔈</span>
            <input
              type="range"
              data-element="volume-slider"
              value={music.volume}
              onChange={(e) => music.setVolume(parseFloat(e.target.value))}
              min={0}
              max={1}
              step={0.05}
              className={css({
                flex: 1,
                height: '6px',
                appearance: 'none',
                bg: isDark ? 'gray.600' : 'gray.300',
                borderRadius: '9999px',
                cursor: 'pointer',
                '&::-webkit-slider-thumb': {
                  appearance: 'none',
                  width: '18px',
                  height: '18px',
                  bg: isDark ? 'blue.400' : 'blue.500',
                  borderRadius: '50%',
                  cursor: 'pointer',
                },
                '&::-moz-range-thumb': {
                  width: '18px',
                  height: '18px',
                  bg: isDark ? 'blue.400' : 'blue.500',
                  borderRadius: '50%',
                  border: 'none',
                  cursor: 'pointer',
                },
                _focus: {
                  outline: 'none',
                },
              })}
            />
            <span className={css({ fontSize: 'lg' })}>🔊</span>
            <span
              className={css({
                fontSize: 'sm',
                fontWeight: 'medium',
                color: isDark ? 'gray.300' : 'gray.700',
                minWidth: '40px',
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
              marginTop: '4',
              padding: '2',
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
            <span>Debug Info</span>
          </button>

          {/* Debug panel */}
          {isDebugExpanded && (
            <div
              data-element="debug-panel"
              className={css({
                marginTop: '2',
                padding: '3',
                bg: isDark ? 'gray.900' : 'gray.100',
                rounded: 'lg',
                fontSize: 'xs',
              })}
            >
              {/* Status info */}
              <div
                className={css({
                  display: 'grid',
                  gridTemplateColumns: 'auto 1fr',
                  gap: '1 2',
                  marginBottom: '3',
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
                  rounded: 'md',
                  padding: '2',
                  maxHeight: '120px',
                  overflow: 'auto',
                  border: '1px solid',
                  borderColor: isDark ? 'gray.700' : 'gray.300',
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
                  padding: '1.5 3',
                  fontSize: 'xs',
                  bg: isDark ? 'gray.700' : 'gray.200',
                  color: isDark ? 'gray.300' : 'gray.700',
                  rounded: 'md',
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

          {/* Close button */}
          <Dialog.Close
            data-action="close-music-modal"
            className={css({
              position: 'absolute',
              top: '3',
              right: '3',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'md',
              padding: '2',
              color: isDark ? 'gray.400' : 'gray.600',
              cursor: 'pointer',
              bg: 'transparent',
              border: 'none',
              _hover: {
                bg: isDark ? 'gray.700' : 'gray.100',
                color: isDark ? 'gray.200' : 'gray.900',
              },
            })}
          >
            ✕
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
