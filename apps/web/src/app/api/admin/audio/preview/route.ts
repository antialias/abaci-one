import { type NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/admin/audio/preview
 *
 * Ephemeral streaming proxy — calls OpenAI TTS and pipes the audio back.
 * Nothing is saved to disk or DB.
 */
export async function POST(request: NextRequest) {
  const apiKey = process.env.LLM_OPENAI_API_KEY || process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'LLM_OPENAI_API_KEY is not configured' }, { status: 500 })
  }

  let body: { voice?: string; text?: string; tone?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { voice, text, tone } = body
  if (!voice || !text) {
    return NextResponse.json({ error: 'voice and text are required' }, { status: 400 })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini-tts',
        voice,
        input: text,
        instructions: tone || undefined,
        response_format: 'mp3',
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      return NextResponse.json(
        { error: `OpenAI API error: HTTP ${response.status}: ${errText}` },
        { status: response.status }
      )
    }

    if (!response.body) {
      return NextResponse.json({ error: 'No response body from OpenAI' }, { status: 502 })
    }

    // Stream the mp3 back directly
    return new NextResponse(response.body as ReadableStream, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Transfer-Encoding': 'chunked',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
