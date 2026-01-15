/**
 * Music Debug Panel
 *
 * Shows the current Strudel pattern code being played,
 * similar to the Strudel REPL view.
 */

'use client'

import { useState } from 'react'
import { css } from '@styled/css'
import { useMusic } from './MusicContext'

interface MusicDebugPanelProps {
  /** Whether the panel starts expanded */
  defaultExpanded?: boolean
}

export function MusicDebugPanel({ defaultExpanded = false }: MusicDebugPanelProps) {
  const music = useMusic()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (!music.isPlaying && !music.currentPattern) {
    return null
  }

  return (
    <div
      data-component="music-debug-panel"
      className={css({
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        zIndex: 9999,
        bg: 'gray.900',
        border: '1px solid',
        borderColor: 'gray.700',
        rounded: 'lg',
        shadow: 'xl',
        overflow: 'hidden',
        maxWidth: isExpanded ? '600px' : '200px',
        transition: 'all 0.2s',
      })}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        data-action="toggle-debug-panel"
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: '2',
          width: '100%',
          padding: '2 3',
          bg: 'gray.800',
          color: 'gray.100',
          fontSize: 'sm',
          fontWeight: 'medium',
          cursor: 'pointer',
          border: 'none',
          _hover: { bg: 'gray.700' },
        })}
      >
        <span>{music.isPlaying ? '🎵' : '⏸️'}</span>
        <span>Music Debug</span>
        <span className={css({ ml: 'auto', color: 'gray.400' })}>{isExpanded ? '▼' : '▲'}</span>
      </button>

      {/* Content */}
      {isExpanded && (
        <div className={css({ padding: '3' })}>
          {/* Status */}
          <div
            className={css({
              display: 'flex',
              gap: '3',
              mb: '3',
              fontSize: 'xs',
              color: 'gray.400',
            })}
          >
            <span>
              Status:{' '}
              <span
                className={css({
                  color: music.isPlaying ? 'green.400' : 'yellow.400',
                })}
              >
                {music.isPlaying ? 'Playing' : 'Paused'}
              </span>
            </span>
            <span>
              Preset: <span className={css({ color: 'blue.400' })}>{music.currentPresetId}</span>
            </span>
            <span>
              Vol:{' '}
              <span className={css({ color: 'purple.400' })}>
                {Math.round(music.volume * 100)}%
              </span>
            </span>
          </div>

          {/* Pattern Code */}
          <div
            className={css({
              bg: 'gray.950',
              rounded: 'md',
              padding: '3',
              maxHeight: '300px',
              overflow: 'auto',
            })}
          >
            <pre
              className={css({
                fontFamily: 'mono',
                fontSize: 'xs',
                lineHeight: '1.5',
                color: 'green.300',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                margin: 0,
              })}
            >
              {formatPattern(music.currentPattern)}
            </pre>
          </div>

          {/* Copy button */}
          <button
            onClick={() => {
              navigator.clipboard.writeText(music.currentPattern)
            }}
            data-action="copy-pattern"
            className={css({
              mt: '2',
              padding: '1 2',
              fontSize: 'xs',
              bg: 'gray.700',
              color: 'gray.300',
              rounded: 'sm',
              border: 'none',
              cursor: 'pointer',
              _hover: { bg: 'gray.600' },
            })}
          >
            📋 Copy to clipboard
          </button>

          {/* Hint for Strudel REPL */}
          <p
            className={css({
              mt: '2',
              fontSize: 'xs',
              color: 'gray.500',
            })}
          >
            Paste into{' '}
            <a
              href="https://strudel.cc/"
              target="_blank"
              rel="noopener noreferrer"
              className={css({
                color: 'blue.400',
                textDecoration: 'underline',
              })}
            >
              strudel.cc
            </a>{' '}
            to visualize with pianoroll
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * Format the pattern for better readability
 */
function formatPattern(pattern: string): string {
  if (!pattern) return '// No pattern loaded'

  // Add some basic formatting
  return pattern
    .replace(/\)\./g, ')\n  .')
    .replace(/,\s*n\(/g, ',\n  n(')
    .replace(/,\s*s\(/g, ',\n  s(')
    .replace(/stack\(\s*/g, 'stack(\n  ')
    .replace(/\)\s*\)/g, ')\n)')
}
