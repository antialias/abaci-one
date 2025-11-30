/**
 * Music Controls Component
 *
 * Simple toggle button for enabling/disabling background music.
 * Volume slider is shown in GameInfoPanel when music is playing.
 */

'use client'

import { css } from '@styled/css'
import { useMusic } from './MusicContext'

interface MusicControlsProps {
  /** Whether to show as compact (icon only) or full (with label) */
  compact?: boolean
  /** Dark mode */
  isDark?: boolean
}

export function MusicControls({ compact = false, isDark = false }: MusicControlsProps) {
  const { isMuted, isPlaying, enableMusic, disableMusic, error } = useMusic()

  const handleToggle = async () => {
    if (isMuted) {
      await enableMusic()
    } else {
      disableMusic()
    }
  }

  const getIcon = () => {
    if (error) return '⚠️'
    if (isMuted) return '🔇'
    if (isPlaying) return '🎵'
    return '🔈'
  }

  const getLabel = () => {
    if (error) return 'Music Error'
    if (isMuted) return 'Enable Music'
    if (isPlaying) return 'Music On'
    return 'Music Paused'
  }

  const getTitle = () => {
    if (error) return `Music error: ${error}`
    if (isMuted) return 'Click to enable background music'
    return 'Click to disable background music'
  }

  return (
    <button
      onClick={handleToggle}
      title={getTitle()}
      data-action="toggle-music"
      data-muted={isMuted}
      data-playing={isPlaying}
      className={css({
        display: 'flex',
        alignItems: 'center',
        gap: compact ? '0' : '1.5',
        padding: compact ? '1.5' : '1.5 2.5',
        fontSize: 'sm',
        cursor: 'pointer',
        bg: 'transparent',
        color: isDark ? 'blue.400' : 'blue.600',
        rounded: 'md',
        border: '1px solid',
        borderColor: isDark ? 'blue.700' : 'blue.300',
        fontWeight: 'medium',
        transition: 'all 0.15s',
        opacity: isMuted ? 0.6 : 0.9,
        _hover: {
          opacity: 1,
          borderColor: isDark ? 'blue.500' : 'blue.400',
          bg: isDark ? 'blue.900/30' : 'blue.50',
        },
        _active: {
          transform: 'scale(0.95)',
        },
      })}
    >
      <span>{getIcon()}</span>
      {!compact && <span>{getLabel()}</span>}
    </button>
  )
}
