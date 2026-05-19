/**
 * API route for serving session song word-alignment JSON.
 *
 * GET /api/audio/songs/[songId]/alignment
 *
 * Serves the ElevenLabs word-timestamp JSON sidecar written next to the MP3
 * at data/audio/songs/{songId}.json. Returns 404 when no sidecar exists
 * (e.g. legacy songs generated before the timestamps feature shipped).
 */

import { readFile, stat } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { withAuth } from '@/lib/auth/withAuth'

const SONGS_DIR = join(process.cwd(), 'data', 'audio', 'songs')

export const GET = withAuth(async (_request, { params }) => {
  try {
    const { songId } = (await params) as { songId: string }

    if (!songId || songId.includes('/') || songId.includes('..')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const filePath = join(SONGS_DIR, `${songId}.json`)

    try {
      await stat(filePath)
    } catch {
      return new NextResponse(null, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving song alignment:', error)
    return new NextResponse(null, { status: 500 })
  }
})
