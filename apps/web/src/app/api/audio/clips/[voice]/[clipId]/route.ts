/**
 * API route for serving audio clip mp3 files.
 *
 * GET /api/audio/clips/[voice]/[clipId]
 *
 * Serves both static manifest clips ({clipId}.mp3) and collected clips
 * (cc-{clipId}.mp3) from data/audio/{voice}/ (NFS-backed in production).
 * No auth required — clip IDs are opaque and audio content is not sensitive.
 */

import { readFile, stat } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { withAuth } from '@/lib/auth/withAuth'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

export const GET = withAuth(async (_request, { params }) => {
  try {
    const { voice, clipId } = (await params) as { voice: string; clipId: string }

    // Validate path segments to prevent directory traversal
    if (
      !voice ||
      !clipId ||
      voice.includes('/') ||
      voice.includes('..') ||
      clipId.includes('/') ||
      clipId.includes('..')
    ) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    // Try mp3 first, then webm — both static ({clipId}.*) and collected (cc-{clipId}.*)
    const candidates = [
      { path: join(AUDIO_DIR, voice, `${clipId}.mp3`), contentType: 'audio/mpeg' },
      { path: join(AUDIO_DIR, voice, `cc-${clipId}.mp3`), contentType: 'audio/mpeg' },
      { path: join(AUDIO_DIR, voice, `${clipId}.webm`), contentType: 'audio/webm' },
      { path: join(AUDIO_DIR, voice, `cc-${clipId}.webm`), contentType: 'audio/webm' },
    ]

    let found: { path: string; contentType: string } | null = null
    for (const candidate of candidates) {
      try {
        await stat(candidate.path)
        found = candidate
        break
      } catch {
        // Not found, try next
      }
    }

    if (!found) {
      return new NextResponse(null, { status: 404 })
    }

    const fileBuffer = await readFile(found.path)

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': found.contentType,
        'Content-Length': fileBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving audio clip:', error)
    return new NextResponse(null, { status: 500 })
  }
})
