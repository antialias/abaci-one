import { type NextRequest, NextResponse } from 'next/server'
import { startAudioGeneration } from '@/lib/tasks/audio-generate'
import { requireAdmin } from '@/lib/auth/requireRole'

/**
 * POST /api/admin/audio/generate
 *
 * Starts a background task to generate all missing TTS clips for a given voice.
 * Returns the task ID for tracking via the background task system.
 *
 * Body: { voice: string }
 * Response: { taskId: string }
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  try {
    const body = await request.json()
    const { voice, clipIds } = body

    if (typeof voice !== 'string' || voice.trim().length === 0) {
      return NextResponse.json({ error: 'voice must be a non-empty string' }, { status: 400 })
    }

    if (
      clipIds !== undefined &&
      (!Array.isArray(clipIds) || !clipIds.every((id: unknown) => typeof id === 'string'))
    ) {
      return NextResponse.json({ error: 'clipIds must be an array of strings' }, { status: 400 })
    }

    const taskId = await startAudioGeneration({
      voice: voice.trim(),
      ...(clipIds ? { clipIds } : {}),
    })

    return NextResponse.json({ taskId })
  } catch (error) {
    console.error('Error starting audio generation:', error)
    return NextResponse.json({ error: 'Failed to start audio generation' }, { status: 500 })
  }
}
