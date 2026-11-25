import { type NextRequest, NextResponse } from 'next/server'
import { generationRefusal } from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'
import { startCollectedClipGeneration } from '@/lib/tasks/collected-clip-generate'

/**
 * POST /api/admin/audio/generate-collected
 *
 * Starts a background task to generate mp3s for collected clips in an
 * ElevenLabs voice. Retired OpenAI voices are refused (400).
 *
 * Body: { voice: string, clipIds: string[] }
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
        !Array.isArray(clipIds) ||
        clipIds.length === 0 ||
        !clipIds.every((id: unknown) => typeof id === 'string')
      ) {
        return NextResponse.json(
          { error: 'clipIds must be a non-empty array of strings' },
          { status: 400 }
        )
      }

      // Only ElevenLabs voices generate; retired OpenAI folders are play-only.
      const refusal = generationRefusal(voice.trim())
      if (refusal) {
        return NextResponse.json({ error: refusal }, { status: 400 })
      }

      const taskId = await startCollectedClipGeneration({
        voice: voice.trim(),
        clipIds,
        _userId: userId,
      })

      return NextResponse.json({ taskId })
    } catch (error) {
      console.error('Error starting collected clip generation:', error)
      return NextResponse.json(
        { error: 'Failed to start collected clip generation' },
        { status: 500 }
      )
    }
  },
  { role: 'admin' }
)
