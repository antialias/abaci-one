/**
 * API route for serving persistent generated images.
 *
 * GET /api/images/[category]/[filename]
 *
 * Serves images from data/generated-images/{category}/{filename}
 * (NFS-backed in production). No auth required.
 */

import { NextResponse } from 'next/server'
import { readPersistentImage } from '@/lib/image-storage'

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
}

interface RouteParams {
  params: Promise<{ category: string; filename: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { category, filename } = await params

    // Validate path segments to prevent directory traversal
    if (
      !category ||
      !filename ||
      category.includes('/') ||
      category.includes('..') ||
      filename.includes('/') ||
      filename.includes('..')
    ) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 })
    }

    const result = await readPersistentImage(category, filename)
    if (!result) {
      return new NextResponse(null, { status: 404 })
    }

    const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase()
    const contentType = CONTENT_TYPES[ext] ?? 'application/octet-stream'

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': result.sizeBytes.toString(),
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    console.error('Error serving generated image:', error)
    return new NextResponse(null, { status: 500 })
  }
}
