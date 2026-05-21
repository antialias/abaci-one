/**
 * Public iMessage-playable preview MP4 for a shared song.
 *
 * Apple's LinkPresentation (per TN3156) renders a tap-to-play overlay only
 * when `og:video` (or `twitter:player:stream`) points at a directly
 * downloadable MP4. The share page advertises this route in its metadata;
 * iMessage's crawler fetches the bytes anonymously, decodes the MP4 (still
 * cover frame + AAC audio), and plays it inline in the message thread.
 *
 * Privacy model mirrors the OG image: public route, no auth, gated by the
 * unguessable share code via `getSharedSong` (the single privacy boundary).
 * No `bumpView` — crawlers must not inflate the human view counter.
 *
 * Caching: the disk file at data/audio/songs/{songId}.mp4 IS the cache. The
 * first request renders the cover PNG and runs ffmpeg; every subsequent hit
 * is a `readFile` of the cached MP4 with `Cache-Control: immutable`. The
 * share-create endpoint kicks a fire-and-forget HEAD to this route so the
 * file is usually warm by the time iMessage's crawler arrives.
 *
 * HEAD support: the share-create warmer uses HEAD. We still run the full
 * generation pipeline on HEAD because the work of producing the bytes is
 * the whole point of the warm-up.
 */

import { readFile, stat } from 'fs/promises'
import { NextResponse } from 'next/server'
import { buildPreviewVideo, previewVideoPath } from '@/lib/song-share/buildPreviewVideo'
import { getSharedSong } from '@/lib/song-share/getSharedSong'
import { renderPreviewCover } from '@/lib/song-share/renderPreviewCover'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface Params {
  params: Promise<{ code: string }>
}

async function ensurePreview(code: string): Promise<{ path: string } | { error: NextResponse }> {
  if (!code || code.includes('/') || code.includes('..')) {
    return { error: NextResponse.json({ error: 'Invalid share code' }, { status: 400 }) }
  }

  const payload = await getSharedSong(code) // no bumpView
  if (!payload) {
    return { error: new NextResponse(null, { status: 404 }) }
  }

  const path = previewVideoPath(payload.song.id)
  try {
    await stat(path)
    return { path }
  } catch {
    // not yet built — fall through
  }

  const coverPng = await renderPreviewCover(payload)
  await buildPreviewVideo({ songId: payload.song.id, coverPng })
  return { path }
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const { code } = await params
    const result = await ensurePreview(code)
    if ('error' in result) return result.error

    const buffer = await readFile(result.path)
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': buffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('Error serving song preview MP4:', err)
    return new NextResponse(null, { status: 500 })
  }
}

export async function HEAD(_request: Request, { params }: Params) {
  try {
    const { code } = await params
    const result = await ensurePreview(code)
    if ('error' in result) return result.error

    const stats = await stat(result.path)
    return new NextResponse(null, {
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Length': stats.size.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (err) {
    console.error('Error in HEAD song preview MP4:', err)
    return new NextResponse(null, { status: 500 })
  }
}
