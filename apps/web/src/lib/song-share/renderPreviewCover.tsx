/**
 * Renders the still cover frame for a shared song's preview MP4 as PNG bytes.
 *
 * Wraps the shared `SongPreviewArtwork` JSX in `next/og`'s `ImageResponse`,
 * consumes its body as an ArrayBuffer, and returns a Node Buffer that the
 * ffmpeg pipeline (`buildPreviewVideo`) feeds as a still-image input.
 *
 * Same visual as the OG link-unfurl PNG by design — the iMessage preview's
 * video track is just the unfurl artwork held for the duration of the audio.
 */

import { ImageResponse } from 'next/og'
import type { SharedSongPayload } from './getSharedSong'
import { SONG_PREVIEW_SIZE, SongPreviewArtwork } from './SongPreviewArtwork'
import { getOgFontConfig } from './ogFont'

export async function renderPreviewCover(payload: SharedSongPayload | null): Promise<Buffer> {
  const { fonts, displayFont } = await getOgFontConfig()
  const response = new ImageResponse(
    <SongPreviewArtwork payload={payload} displayFont={displayFont} />,
    { ...SONG_PREVIEW_SIZE, fonts }
  )
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
