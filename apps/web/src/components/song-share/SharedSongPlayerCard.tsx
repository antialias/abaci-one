'use client'

/**
 * Client wrapper around `SyncedLyricsPlayer` for the public song-share page.
 *
 * The share page is a server component and can't pass function props across
 * the server/client boundary, so this thin shell holds the `onFirstPlay`
 * handler that fires the celebration confetti the first time the song
 * actually starts playing (per-mount; pause/resume does not re-fire).
 */

import { SyncedLyricsPlayer } from '@/components/song/SyncedLyricsPlayer'
import type { SyncedLyricsPlayerProps } from '@/components/song/SyncedLyricsPlayer'
import { fireConfettiCelebration } from '@/utils/confetti'

type Props = Omit<SyncedLyricsPlayerProps, 'onFirstPlay'>

export function SharedSongPlayerCard(props: Props) {
  return <SyncedLyricsPlayer {...props} onFirstPlay={fireConfettiCelebration} />
}
