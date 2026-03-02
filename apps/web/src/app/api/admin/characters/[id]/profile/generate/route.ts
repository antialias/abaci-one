/**
 * POST /api/admin/characters/[id]/profile/generate
 *
 * Generate a profile image for a character.
 * Body: { provider?, model?, variant?: 'default' | 'light' | 'dark', forceRegenerate? }
 */

import { NextResponse, type NextRequest } from 'next/server'
import { CHARACTER_PROVIDERS } from '@/lib/character/characters'
import { generateAndStoreImage } from '@/lib/image-generation'

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
    const model = body.model || (imageProvider === 'gemini' ? 'gemini-2.5-flash-image' : 'gpt-image-1')
    const variant: string = body.variant || 'default'

    const data = provider.getFullData()
    const prompt = data.identity.profilePrompt

    // Determine file path based on variant
    const profileBase = data.identity.profileImage.replace(/^\//, '')
    let relativePath: string
    if (variant === 'light') {
      relativePath = profileBase.replace('.png', '-light.png')
    } else if (variant === 'dark') {
      relativePath = profileBase.replace('.png', '-dark.png')
    } else {
      relativePath = profileBase
    }

    const result = await generateAndStoreImage({
      provider: imageProvider,
      model,
      prompt,
      imageOptions: { size: { width: 1024, height: 1024 } },
      storageTarget: {
        type: 'static',
        relativePath,
      },
      skipIfExists: !body.forceRegenerate,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error(`[characters/${id}/profile] Error:`, error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
