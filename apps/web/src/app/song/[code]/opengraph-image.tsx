/**
 * Link-unfurl card for a shared celebration song.
 *
 * Honours the share's privacy projection only: it fetches via `getSharedSong`
 * (the single privacy boundary) WITHOUT `bumpView` — a crawler/preview must
 * not inflate the human view count — and renders just what that projection
 * already permitted (no toggle logic, no raw facts, baked into the PNG).
 *
 * The artwork itself is shared with the iMessage preview MP4's still cover
 * frame, so both unfurl surfaces look identical. See
 * `lib/song-share/SongPreviewArtwork.tsx` for the visual; this file is just
 * the OG-route envelope.
 */

import { ImageResponse } from 'next/og'
import { getSharedSong } from '@/lib/song-share/getSharedSong'
import { getOgFontConfig } from '@/lib/song-share/ogFont'
import { SONG_PREVIEW_SIZE, SongPreviewArtwork } from '@/lib/song-share/SongPreviewArtwork'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const alt = 'A celebration song on Abaci.One'
export const size = SONG_PREVIEW_SIZE
export const contentType = 'image/png'

interface OGImageProps {
  params: Promise<{ code: string }>
}

export default async function Image({ params }: OGImageProps) {
  const { code } = await params
  const payload = await getSharedSong(code) // no bumpView
  const { fonts, displayFont } = await getOgFontConfig()

  return new ImageResponse(<SongPreviewArtwork payload={payload} displayFont={displayFont} />, {
    ...size,
    fonts,
  })
}
