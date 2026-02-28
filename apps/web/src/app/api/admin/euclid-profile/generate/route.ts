/**
 * One-off API route to generate a profile picture for Εὐκλείδης (Euclid).
 *
 * POST /api/admin/euclid-profile/generate
 * Body: { provider?: 'gemini' | 'openai', model?: string, forceRegenerate?: boolean }
 *
 * Stores the result at /public/images/euclid-profile.png
 */

import { NextResponse } from 'next/server'
import { generateAndStoreImage } from '@/lib/image-generation'

const PROMPT = [
  "Portrait of Euclid (Εὐκλείδης) of Alexandria, depicted as an iPhone contact profile picture.",
  "Circular crop-friendly composition centered on the face/bust.",
  "Ancient Greek man, dignified, wise, warm expression, short curly grey-white beard, draped in a simple cream chiton.",
  "Background: warm parchment with faint geometric compass arcs and construction lines in the style of Oliver Byrne's illustrated Euclid — bold flat primary colors (red, blue, gold) for the geometric accents.",
  "Art style: clean illustration, slightly stylized (not photorealistic), warm tones, approachable and friendly — this is a teacher children will talk to.",
  "No text, no labels, no letters. Square 1:1 composition.",
].join(' ')

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}))
    const provider = body.provider || 'gemini'
    const model = body.model || (provider === 'gemini' ? 'gemini-2.5-flash-image' : 'gpt-image-1')

    const result = await generateAndStoreImage({
      provider,
      model,
      prompt: PROMPT,
      imageOptions: { size: { width: 1024, height: 1024 } },
      storageTarget: {
        type: 'static',
        relativePath: 'images/euclid-profile.png',
      },
      skipIfExists: !body.forceRegenerate,
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[euclid-profile] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
