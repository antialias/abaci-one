/**
 * Stories for SessionSongPlayer — renders each visual state directly
 * without needing the useSessionSong hook (which requires API access).
 *
 * We render the internal markup directly to show each state.
 */
import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'
import { css } from '../../../styled-system/css'

// ============================================================================
// Presentational wrappers that replicate the component's visual states
// without the hook dependency
// ============================================================================

function PlayerShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      data-component="session-song-player"
      className={css({
        mx: 'auto',
        maxW: '480px',
        p: 4,
        borderRadius: 'xl',
        bg: 'purple.50',
        _dark: { bg: 'purple.900/30' },
        mb: 4,
      })}
    >
      {children}
    </div>
  )
}

function GeneratingState() {
  return (
    <PlayerShell>
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 3,
          py: 2,
        })}
      >
        <div
          className={css({
            w: 8,
            h: 8,
            borderRadius: 'full',
            bg: 'purple.200',
            _dark: { bg: 'purple.700' },
            animation: 'pulse 1.5s ease-in-out infinite',
            flexShrink: 0,
          })}
        />
        <span
          className={css({
            fontSize: 'sm',
            color: 'purple.700',
            _dark: { color: 'purple.200' },
            fontWeight: 'medium',
          })}
        >
          Creating your song...
        </span>
      </div>
    </PlayerShell>
  )
}

function TapToPlayState({ title }: { title: string }) {
  const [tapped, setTapped] = useState(false)

  if (tapped) {
    return <ReadyPlayerState title={title} simulatePlaying />
  }

  return (
    <PlayerShell>
      <button
        data-action="tap-to-play"
        onClick={() => setTapped(true)}
        className={css({
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 2,
          w: '100%',
          py: 3,
          border: 'none',
          bg: 'transparent',
          cursor: 'pointer',
        })}
      >
        <div
          className={css({
            w: 16,
            h: 16,
            borderRadius: 'full',
            bg: 'purple.500',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '2xl',
            animation: 'pulse 1.5s ease-in-out infinite',
          })}
        >
          {'\u25B6'}
        </div>
        <span
          className={css({
            fontSize: 'md',
            fontWeight: 'bold',
            color: 'purple.700',
            _dark: { color: 'purple.200' },
          })}
        >
          Tap to play your song!
        </span>
        <span
          className={css({
            fontSize: 'sm',
            color: 'purple.500',
            _dark: { color: 'purple.300' },
          })}
        >
          {title}
        </span>
      </button>
    </PlayerShell>
  )
}

function ReadyPlayerState({
  title,
  simulatePlaying = false,
}: {
  title: string
  simulatePlaying?: boolean
}) {
  const [isPlaying, setIsPlaying] = useState(simulatePlaying)
  const progress = simulatePlaying ? 35 : 0
  const currentTime = simulatePlaying ? '0:16' : '0:00'
  const totalTime = '0:45'

  return (
    <PlayerShell>
      {/* Title */}
      <div
        className={css({
          fontSize: 'md',
          fontWeight: 'bold',
          color: 'purple.800',
          _dark: { color: 'purple.100' },
          mb: 3,
          textAlign: 'center',
        })}
      >
        {title}
      </div>

      {/* Play button + progress */}
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          gap: 3,
        })}
      >
        <button
          data-action="toggle-play"
          onClick={() => setIsPlaying(!isPlaying)}
          className={css({
            w: 12,
            h: 12,
            borderRadius: 'full',
            bg: 'purple.500',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 'xl',
            cursor: 'pointer',
            flexShrink: 0,
            border: 'none',
            _hover: { bg: 'purple.600' },
            _active: { bg: 'purple.700' },
            transition: 'background 0.15s',
          })}
        >
          {isPlaying ? '\u23F8' : '\u25B6'}
        </button>

        <div className={css({ flex: 1, minW: 0 })}>
          <div
            data-element="progress-bar"
            className={css({
              h: 2,
              bg: 'purple.200',
              _dark: { bg: 'purple.700' },
              borderRadius: 'full',
              cursor: 'pointer',
              position: 'relative',
              mb: 1,
            })}
          >
            <div
              className={css({
                h: '100%',
                bg: 'purple.500',
                borderRadius: 'full',
                transition: 'width 0.1s linear',
              })}
              style={{ width: `${progress}%` }}
            />
          </div>

          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: 'xs',
              color: 'purple.500',
              _dark: { color: 'purple.300' },
            })}
          >
            <span>{currentTime}</span>
            <span>{totalTime}</span>
          </div>
        </div>
      </div>
    </PlayerShell>
  )
}

// ============================================================================
// Meta
// ============================================================================

const meta: Meta = {
  title: 'Practice/SessionSongPlayer',
  decorators: [
    (Story) => (
      <div
        className={css({
          padding: '2rem',
          maxWidth: '500px',
          margin: '0 auto',
        })}
      >
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
}

export default meta
type Story = StoryObj

// ============================================================================
// Stories
// ============================================================================

/** Song is being generated in the background. Pulsing shimmer animation. */
export const Generating: Story = {
  render: () => <GeneratingState />,
}

/**
 * Song is ready but autoplay was blocked by the browser.
 * Large pulsing play button with "Tap to play your song!" prompt.
 * Click the button to transition to the normal player.
 */
export const AutoplayBlocked: Story = {
  render: () => <TapToPlayState title="Sonia Counts to Victory" />,
}

/** Normal player with title, play/pause, seekable progress bar. */
export const ReadyPaused: Story = {
  render: () => <ReadyPlayerState title="Abacus Adventures with Fern" />,
}

/** Player mid-playback showing progress. */
export const ReadyPlaying: Story = {
  render: () => <ReadyPlayerState title="Abacus Adventures with Fern" simulatePlaying />,
}

/**
 * No song / failed states render nothing.
 * Shown here with a placeholder to confirm emptiness.
 */
export const NoSongOrFailed: Story = {
  render: () => (
    <div className={css({ textAlign: 'center', color: 'gray.400', fontSize: 'sm' })}>
      (Component renders nothing when no song exists or generation failed)
    </div>
  ),
}
