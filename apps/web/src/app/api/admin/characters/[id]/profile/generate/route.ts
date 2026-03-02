/**
 * POST /api/admin/characters/[id]/profile/generate
 *
 * Start a background task to generate a profile image for a character.
 * Returns { taskId } for the client to track via useBackgroundTask.
 *
 * Body: { provider?, model?, size?, theme?, cascade?, forceRegenerate? }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { CHARACTER_PROVIDERS } from '@/lib/character/characters'
import {
  startProfileImageGeneration,
  type ProfileSize,
  type ProfileTheme,
  type ProfileState,
} from '@/lib/tasks/profile-image-generate'

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params
  const provider = CHARACTER_PROVIDERS[id]
  if (!provider) {
    return NextResponse.json({ error: `Character '${id}' not found` }, { status: 404 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const imageProvider = body.provider || 'gemini'
    const model =
      body.model || (imageProvider === 'gemini' ? 'gemini-3-pro-image-preview' : 'gpt-image-1')
    const size: ProfileSize = body.size || 'default'
    const theme: ProfileTheme = body.theme || 'default'
    const state: ProfileState = body.state || 'idle'
    const cascade: boolean = body.cascade ?? false

    const taskId = await startProfileImageGeneration({
      provider: imageProvider,
      model,
      characterId: id,
      size,
      theme,
      state,
      cascade,
      forceRegenerate: !!body.forceRegenerate,
    })

    return NextResponse.json({ taskId })
  } catch (error) {
    console.error(`[characters/${id}/profile] Error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
