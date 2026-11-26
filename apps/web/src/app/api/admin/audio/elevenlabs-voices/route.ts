import { NextResponse } from 'next/server'
import { elevenLabsVoiceFolder } from '@/lib/audio/voices'
import { withAuth } from '@/lib/auth/withAuth'
import { listElevenLabsVoices, SpeechError } from '@/lib/speech/synthesize'

/**
 * GET /api/admin/audio/elevenlabs-voices
 *
 * The ElevenLabs voices an admin can add to the voice chain, from the switch
 * proxy's door (GET /v1/voices), each with the folder its clips live in.
 *
 * Response: { voices: Array<{ folder, voiceId, name, category }> }
 */
export const GET = withAuth(
  async () => {
    try {
      const voices = await listElevenLabsVoices()
      return NextResponse.json({
        voices: voices.map((v) => ({ ...v, folder: elevenLabsVoiceFolder(v.voiceId) })),
      })
    } catch (err) {
      if (err instanceof SpeechError) {
        return NextResponse.json({ error: err.message }, { status: err.httpStatus })
      }
      console.error('[elevenlabs-voices] Error:', err)
      return NextResponse.json({ error: 'Failed to list ElevenLabs voices' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
