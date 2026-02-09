/**
 * API route for serving pre-generated collected clip mp3 files.
 *
 * GET /api/audio/clips/[voice]/[clipId]
 *
 * Reads from data/audio/{voice}/cc-{clipId}.mp3 (NFS-backed in production).
 * No auth required — clip IDs are opaque hashes and audio content is not sensitive.
 */

import { readFile, stat } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

interface RouteParams {
  params: Promise<{ voice: string; clipId: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { voice, clipId } = await params

    // Validate path segments to prevent directory traversal
    if (!voice || !clipId || voice.includes('/') || voice.includes('..') || clipId.includes('/') || clipId.includes('..')) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const filepath = join(AUDIO_DIR, voice, `cc-${clipId}.mp3`)

    try {
      await stat(filepath)
    } catch {
      return new NextResponse(null, { status: 404 })
    }

    const fileBuffer = await readFile(filepath)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving audio clip:', error)
    return new NextResponse(null, { status: 500 })
  }
}
