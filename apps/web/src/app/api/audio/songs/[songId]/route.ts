/**
 * API route for serving session song MP3 files.
 *
 * GET /api/audio/songs/[songId]
 *
 * Serves MP3 from data/audio/songs/{songId}.mp3.
 * Auth required — songs are tied to specific students.
 */

import { readFile, stat } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { withAuth } from '@/lib/auth/withAuth'

const SONGS_DIR = join(process.cwd(), 'data', 'audio', 'songs')

export const GET = withAuth(async (_request, { params }) => {
  try {
    const { songId } = (await params) as { songId: string }

    // Validate path segment to prevent directory traversal
    if (!songId || songId.includes('/') || songId.includes('..')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const filePath = join(SONGS_DIR, `${songId}.mp3`)

    try {
      await stat(filePath)
    } catch {
      return new NextResponse(null, { status: 404 })
    }

    const fileBuffer = await readFile(filePath)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving song audio:', error)
    return new NextResponse(null, { status: 500 })
  }
})
