import { NextResponse } from 'next/server'
import type { MomentSnapshot } from '@/db/schema/number-line-postcards'

export const dynamic = 'force-dynamic'

/**
 * POST /api/demo/moment-screenshot
 *
 * Dev-only endpoint that exercises the exact server-side rendering pipeline
 * used by postcard-generate.ts. Accepts an array of MomentSnapshots and
 * returns the rendered PNG (single full-size or 2x2 tiled grid).
 */
export async function POST(req: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Dev only' }, { status: 403 })
  }

  const body = (await req.json()) as { snapshots: MomentSnapshot[] }
  const snapshots = body.snapshots
  if (!Array.isArray(snapshots) || snapshots.length === 0) {
    return NextResponse.json({ error: 'snapshots array required' }, { status: 400 })
  }

  const { createServerCanvas } = await import('@/lib/server-canvas')
  const { renderMomentScene } = await import('@/components/toys/number-line/renderMomentScene')

  const momentCount = Math.min(snapshots.length, 4)
  let pngBuffer: Buffer

  if (momentCount === 1) {
    const width = 800
    const height = 600
    const canvas = createServerCanvas(width, height)
    const ctx = canvas.getContext('2d')
    renderMomentScene(ctx as unknown as CanvasRenderingContext2D, snapshots[0], width, height)
    pngBuffer = canvas.toBuffer('image/png')
  } else {
    const tileW = 400
    const tileH = 300
    const canvas = createServerCanvas(800, 600)
    const ctx = canvas.getContext('2d')
    for (let i = 0; i < momentCount; i++) {
      const tileCanvas = createServerCanvas(tileW, tileH)
      const tileCtx = tileCanvas.getContext('2d')
      renderMomentScene(tileCtx as unknown as CanvasRenderingContext2D, snapshots[i], tileW, tileH)
      const col = i % 2
      const row = Math.floor(i / 2)
      ;(ctx as unknown as CanvasRenderingContext2D).drawImage(
        tileCanvas as unknown as CanvasImageSource,
        col * tileW,
        row * tileH
      )
    }
    pngBuffer = canvas.toBuffer('image/png')
  }

  return new NextResponse(new Uint8Array(pngBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'no-store',
    },
  })
}
