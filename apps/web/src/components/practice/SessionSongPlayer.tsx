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

export function SessionSongPlayer({
  playerId,
  planId,
  triggerFallback = false,
}: SessionSongPlayerProps) {
  const { song, isGenerating, isReady, failureKind, errorDetail, viewerIsOwner } = useSessionSong({
    playerId,
    planId,
    enabled: true,
  })

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
      {isGenerating && !isReady && (
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
            Creating your song...
          </span>
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
