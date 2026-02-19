/**
 * API routes for managing custom voice recordings.
 *
 * POST   — Upload a recorded clip (webm blob via FormData)
 * PATCH  — Deactivate or reactivate a clip
 * DELETE — Permanently remove a clip
 */

import { mkdir, rename, unlink, stat } from 'fs/promises'
import { NextResponse } from 'next/server'
import { join } from 'path'
import { requireAdmin } from '@/lib/auth/requireRole'

const AUDIO_DIR = join(process.cwd(), 'data', 'audio')

interface RouteParams {
  params: Promise<{ voice: string; clipId: string }>
}

function validateSegment(segment: string): boolean {
  return !!segment && !segment.includes('/') && !segment.includes('..') && !segment.includes('\0')
}

/**
 * POST /api/admin/audio/custom-clips/[voice]/[clipId]
 *
 * Upload a recorded audio clip. Expects multipart FormData with an `audio` field.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { voice, clipId } = await params

    if (!validateSegment(voice) || !validateSegment(clipId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const formData = await request.formData()
    const audioBlob = formData.get('audio')

    if (!audioBlob || !(audioBlob instanceof Blob)) {
      return NextResponse.json({ error: 'Missing audio blob in form data' }, { status: 400 })
    }

    const voiceDir = join(AUDIO_DIR, voice)
    await mkdir(voiceDir, { recursive: true })

    const buffer = Buffer.from(await audioBlob.arrayBuffer())
    const filePath = join(voiceDir, `cc-${clipId}.webm`)

    const { writeFile } = await import('fs/promises')
    await writeFile(filePath, buffer)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error uploading custom clip:', error)
    return NextResponse.json({ error: 'Failed to upload clip' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/audio/custom-clips/[voice]/[clipId]
 *
 * Deactivate or reactivate a clip.
 * Body: { action: 'deactivate' | 'reactivate' }
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { voice, clipId } = await params

    if (!validateSegment(voice) || !validateSegment(clipId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const body = await request.json()
    const { action } = body as { action: string }

    if (action !== 'deactivate' && action !== 'reactivate') {
      return NextResponse.json({ error: 'action must be "deactivate" or "reactivate"' }, { status: 400 })
    }

    const voiceDir = join(AUDIO_DIR, voice)
    const deactivatedDir = join(voiceDir, '.deactivated')

    // Try both .webm and .mp3
    const extensions = ['.webm', '.mp3']

    for (const ext of extensions) {
      const activePath = join(voiceDir, `cc-${clipId}${ext}`)
      const deactivatedPath = join(deactivatedDir, `cc-${clipId}${ext}`)

      if (action === 'deactivate') {
        try {
          await stat(activePath)
          await mkdir(deactivatedDir, { recursive: true })
          await rename(activePath, deactivatedPath)
        } catch {
          // File doesn't exist in this extension, skip
        }
      } else {
        try {
          await stat(deactivatedPath)
          await rename(deactivatedPath, activePath)
        } catch {
          // File doesn't exist in this extension, skip
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error patching custom clip:', error)
    return NextResponse.json({ error: 'Failed to update clip' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/audio/custom-clips/[voice]/[clipId]
 *
 * Permanently remove a clip from both active and deactivated locations.
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const { voice, clipId } = await params

    if (!validateSegment(voice) || !validateSegment(clipId)) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const voiceDir = join(AUDIO_DIR, voice)
    const deactivatedDir = join(voiceDir, '.deactivated')

    const extensions = ['.webm', '.mp3']
    const prefixes = ['cc-', '']

    for (const ext of extensions) {
      for (const prefix of prefixes) {
        for (const dir of [voiceDir, deactivatedDir]) {
          try {
            await unlink(join(dir, `${prefix}${clipId}${ext}`))
          } catch {
            // File doesn't exist, skip
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error deleting custom clip:', error)
    return NextResponse.json({ error: 'Failed to delete clip' }, { status: 500 })
  }
}
