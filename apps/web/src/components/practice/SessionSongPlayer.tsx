'use client'

/**
 * Kid-friendly audio player for AI-generated session celebration songs.
 *
 * Delegates the "ready" state to <SyncedLyricsPlayer> — the integrated
 * lyrics + playback surface where the lyrics ARE the player (each word
 * is a seek target, active word highlights as it's sung).
 *
 * States:
 * - Generating: animated shimmer with "Creating your song..." text
 * - Ready: <SyncedLyricsPlayer variant="compact" />
 * - Failed: <SongFailureCard>
 * - Absent: renders nothing (don't show errors to kids)
 */

import { useEffect, useRef } from 'react'
import { useElapsedMs } from '@/hooks/useElapsedMs'
import { useSessionSong } from '@/hooks/useSessionSong'
import { ShareSongPopover } from '@/components/song/ShareSongPopover'
import { SyncedLyricsPlayer } from '@/components/song/SyncedLyricsPlayer'
import { SongFailureCard } from './SongFailureCard'
import { css } from '../../../styled-system/css'

interface SessionSongPlayerProps {
  playerId: string
  planId: string
  /** Whether to trigger a completion fallback POST if no song exists */
  triggerFallback?: boolean
}

const GENERATING_COPY: Record<string, string> = {
  pending: 'Getting ready to write your song...',
  prompt_generating: 'Listening to how your session went...',
  generating: 'Writing your celebration song 🎵',
}

function getGeneratingCopy(status: string | undefined): string {
  return (status && GENERATING_COPY[status]) || 'Creating your song...'
}

const LONG_GENERATION_MS = 45_000
const VERY_LONG_GENERATION_MS = 180_000
const LONG_GENERATION_COPY = "Still cooking — this one's taking a little longer, hang tight!"
const VERY_LONG_GENERATION_COPY = "You can come back later — we'll have it ready for you"

function getReassuranceCopy(status: string | undefined, elapsedMs: number | null): string {
  if (elapsedMs != null && elapsedMs >= VERY_LONG_GENERATION_MS) {
    return VERY_LONG_GENERATION_COPY
  }
  if (elapsedMs != null && elapsedMs >= LONG_GENERATION_MS) {
    return LONG_GENERATION_COPY
  }
  return getGeneratingCopy(status)
}

const CONNECTION_LOST_COPY =
  "Lost the live updates — your song is still cooking, but we won't see it the moment it's done."
const CONNECTION_LOST_OWNER_COPY =
  'Lost the realtime connection to the server. The song is still generating in the background — reconnect to resume live updates.'

export function SessionSongPlayer({
  playerId,
  planId,
  triggerFallback = false,
}: SessionSongPlayerProps) {
  const {
    song,
    isGenerating,
    isReady,
    failureKind,
    errorDetail,
    viewerIsOwner,
    connectionState,
    reconnect,
  } = useSessionSong({
    playerId,
    planId,
    enabled: true,
  })

  const elapsedMs = useElapsedMs(song?.createdAt ?? null)

  const fallbackTriggered = useRef(false)

  // Fire completion fallback trigger if needed
  useEffect(() => {
    if (triggerFallback && !song && !fallbackTriggered.current) {
      fallbackTriggered.current = true
      fetch(`/api/curriculum/${playerId}/sessions/plans/${planId}/song`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ triggerSource: 'completion_fallback' }),
      }).catch(() => {
        // Fire and forget
      })
    }
  }, [triggerFallback, song, playerId, planId])

  // Don't render anything if there's no song at all
  if (!song && !isGenerating) return null

  // Show a soft failure card instead of silently swallowing failures.
  // Kid sees a warm one-liner; account owners/admins also see remediation.
  if (song?.status === 'failed') {
    return (
      <SongFailureCard
        failureKind={failureKind}
        errorDetail={errorDetail}
        viewerIsOwner={viewerIsOwner}
      />
    )
  }

  return (
    <div
      data-component="session-song-player"
      className={css({
        mx: 'auto',
        maxW: '480px',
        mb: 4,
      })}
    >
      {isGenerating && !isReady && connectionState !== 'lost' && (
        <div
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            p: 4,
            borderRadius: 'xl',
            bg: 'purple.50',
            _dark: { bg: 'purple.900/30' },
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
            {getReassuranceCopy(song?.status, elapsedMs)}
            {connectionState === 'reconnecting' && (
              <span
                className={css({
                  ml: 2,
                  fontSize: 'xs',
                  color: 'purple.500',
                  _dark: { color: 'purple.400' },
                  fontStyle: 'italic',
                })}
              >
                · reconnecting…
              </span>
            )}
          </span>
        </div>
      )}

      {isGenerating && !isReady && connectionState === 'lost' && (
        <div
          data-element="connection-lost"
          className={css({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'start',
            gap: 2,
            p: 4,
            borderRadius: 'xl',
            bg: 'amber.50',
            border: '1px solid',
            borderColor: 'amber.200',
            _dark: { bg: 'amber.900/30', borderColor: 'amber.700' },
          })}
        >
          <span
            className={css({
              fontSize: 'sm',
              color: 'amber.800',
              _dark: { color: 'amber.100' },
              fontWeight: 'medium',
            })}
          >
            {viewerIsOwner ? CONNECTION_LOST_OWNER_COPY : CONNECTION_LOST_COPY}
          </span>
          <button
            type="button"
            data-action="reconnect-session-song"
            onClick={reconnect}
            className={css({
              fontSize: 'xs',
              fontWeight: 'bold',
              color: 'amber.900',
              _dark: { color: 'amber.100' },
              textDecoration: 'underline',
              cursor: 'pointer',
              border: 'none',
              bg: 'transparent',
              p: 0,
            })}
          >
            Reconnect
          </button>
        </div>
      )}

      {isReady && song?.audioPath && (
        <SyncedLyricsPlayer
          audioPath={song.audioPath}
          alignmentPath={song.alignmentPath}
          lyrics={song.lyrics ?? []}
          title={song.title}
          variant="compact"
          autoPlay
          footer={song.id ? <ShareSongPopover songId={song.id} songTitle={song.title} /> : null}
        />
      )}
    </div>
  )
}
