import { type NextRequest, NextResponse } from 'next/server'
import { generationRefusal } from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'
import { startAudioGeneration } from '@/lib/tasks/audio-generate'

/**
 * POST /api/admin/audio/generate
 *
 * Starts a background task to generate all missing TTS clips for an
 * ElevenLabs voice. Retired OpenAI voices are refused (400).
 * Returns the task ID for tracking via the background task system.
 *
 * Body: { voice: string }
 * Response: { taskId: string }
 */
export const POST = withAuth(
  async (request: NextRequest, { userId }) => {
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

      // Only ElevenLabs voices generate; retired OpenAI folders are play-only.
      const refusal = generationRefusal(voice.trim())
      if (refusal) {
        return NextResponse.json({ error: refusal }, { status: 400 })
      }

      const taskId = await startAudioGeneration({
        voice: voice.trim(),
        ...(clipIds ? { clipIds } : {}),
        _userId: userId,
      })

      return NextResponse.json({ taskId })
    } catch (error) {
      console.error('Error starting audio generation:', error)
      return NextResponse.json({ error: 'Failed to start audio generation' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
