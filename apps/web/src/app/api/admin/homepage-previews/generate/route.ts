import { type NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { getPreviewTarget } from '@/lib/homepage-previews'
import { generateAndStoreImage } from '@/lib/image-generation'
import { storeImage } from '@/lib/image-storage'
import { parseImageClassParam } from '@/lib/images/switch-images'

/**
 * POST /api/admin/homepage-previews/generate
 *
 * Two modes:
 *
 * 1. Canvas capture (client sends rendered PNG):
 *    Body: { id, imageData }   — imageData is a base64 data URL
 *
 * 2. AI generation:
 *    Body: { id, imageClass? }
 */
export const POST = withAuth(
  async (request: NextRequest) => {
    try {
      const body = await request.json()
      const { id, imageData } = body

      if (!id || typeof id !== 'string') {
        return NextResponse.json({ error: 'id is required' }, { status: 400 })
      }

      const target = getPreviewTarget(id)
      if (!target) {
        return NextResponse.json({ error: `Unknown preview target: ${id}` }, { status: 404 })
      }

      const storageTarget = {
        type: 'static' as const,
        relativePath: `images/homepage/${id}.png`,
      }

      // Mode 1: Client-side canvas capture
      if (imageData) {
        // Expect "data:image/png;base64,..."
        const match = (imageData as string).match(/^data:image\/png;base64,(.+)$/)
        if (!match) {
          return NextResponse.json(
            { error: 'imageData must be a base64 PNG data URL' },
            { status: 400 }
          )
        }

        const buffer = Buffer.from(match[1], 'base64')
        const result = storeImage(storageTarget, buffer)

        return NextResponse.json({
          id,
          status: 'stored',
          publicUrl: result.publicUrl,
          sizeBytes: result.sizeBytes,
        })
      }

      // Mode 2: AI generation
      if (target.type !== 'ai') {
        return NextResponse.json(
          { error: 'Canvas targets must provide imageData from client-side capture' },
          { status: 400 }
        )
      }

      const parsedClass = parseImageClassParam(body.imageClass)
      if (!parsedClass.ok) {
        return NextResponse.json({ error: parsedClass.error }, { status: 400 })
      }

      const result = await generateAndStoreImage({
        imageClass: parsedClass.imageClass,
        prompt: target.prompt,
        storageTarget,
        size: { width: target.width, height: target.height },
      })

      return NextResponse.json({
        id,
        status: result.status,
        publicUrl: result.publicUrl,
        sizeBytes: result.status === 'generated' ? result.sizeBytes : undefined,
      })
    } catch (error) {
      console.error('Error generating homepage preview:', error)
      return NextResponse.json({ error: 'Failed to generate homepage preview' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
