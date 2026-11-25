/**
 * POST /api/admin/characters/[id]/profile/generate
 *
 * Start a background task to generate a profile image for a character.
 * Returns { taskId } for the client to track via useBackgroundTask.
 *
 * Body: { imageClass?, size?, theme?, cascade?, forceRegenerate? }
 */

import { type NextRequest, NextResponse } from 'next/server'
import { CHARACTER_PROVIDERS } from '@/lib/character/characters'
import { parseImageClassParam } from '@/lib/images/switch-images'
import {
  type ProfileSize,
  type ProfileState,
  type ProfileTheme,
  startProfileImageGeneration,
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
    const parsedClass = parseImageClassParam(body.imageClass)
    if (!parsedClass.ok) {
      return NextResponse.json({ error: parsedClass.error }, { status: 400 })
    }
    const size: ProfileSize = body.size || 'default'
    const theme: ProfileTheme = body.theme || 'default'
    const state: ProfileState = body.state || 'idle'
    const cascade: boolean = body.cascade ?? false

    const taskId = await startProfileImageGeneration({
      imageClass: parsedClass.imageClass,
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
