"use client";

/**
 * Abaci adapter for the shared Tidepool karaoke package.
 *
 * Abaci owns the immutable alignment fetch and query cache; the package owns
 * playback, synchronization, seeking, variants, and presentation. Keeping
 * this adapter preserves the existing app-facing API while removing the local
 * player implementation.
 */

import {
  KaraokePlayer,
  type KaraokePlayerProps,
  type SongLyricsSection,
} from "@tidepool/karaoke-player";
import { useSongAlignment } from "@/hooks/useSongAlignment";

export type SyncedLyricsVariant = NonNullable<KaraokePlayerProps["variant"]>;

export interface SyncedLyricsPlayerProps
  extends Omit<KaraokePlayerProps, "audioSrc" | "alignment" | "lyrics"> {
  audioPath: string;
  alignmentPath: string | null;
  lyrics: SongLyricsSection[];
}

export function SyncedLyricsPlayer({
  audioPath,
  alignmentPath,
  lyrics,
  ...props
}: SyncedLyricsPlayerProps) {
  const alignmentQuery = useSongAlignment(alignmentPath);

  return (
    <KaraokePlayer
      {...props}
      audioSrc={audioPath}
      lyrics={lyrics}
      alignment={alignmentQuery.data ?? null}
    />
  );
}
