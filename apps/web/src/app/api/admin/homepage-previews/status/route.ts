import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { PREVIEW_TARGETS } from '@/lib/homepage-previews'
import { IMAGE_PROVIDERS } from '@/lib/image-providers'
import { requireAdmin } from '@/lib/auth/requireRole'

const HOMEPAGE_IMAGES_DIR = join(process.cwd(), 'public', 'images', 'homepage')

/**
 * GET /api/admin/homepage-previews/status
 *
 * Returns all preview targets with their image existence and file size.
 */
export async function GET() {
  const auth = await requireAdmin()
  if (auth instanceof NextResponse) return auth

  const targets = PREVIEW_TARGETS.map((target) => {
    const filePath = join(HOMEPAGE_IMAGES_DIR, `${target.id}.png`)
    const exists = existsSync(filePath)

    return {
      id: target.id,
      type: target.type,
      label: target.label,
      width: target.width,
      height: target.height,
      prompt: target.type === 'ai' ? target.prompt : undefined,
      imageExists: exists,
      sizeBytes: exists ? statSync(filePath).size : undefined,
    }
  })

  const providers = IMAGE_PROVIDERS.map((p) => {
    const hasKey =
      'envKeyAlt' in p
        ? !!(process.env[p.envKey] || process.env[p.envKeyAlt!])
        : !!process.env[p.envKey]

    return {
      id: p.id,
      name: p.name,
      available: hasKey,
      models: p.models.map((m) => ({ id: m.id, name: m.name })),
    }
  })

  return NextResponse.json({ targets, providers })
}
