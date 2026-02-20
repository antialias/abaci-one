import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import { assetStore } from '@/lib/asset-store'

export const GET = withAuth(async (_request, { params }) => {
  try {
    const { id } = (await params) as { id: string }

    const asset = await assetStore.get(id)
    if (!asset) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 })
    }

    // Set appropriate headers for download
    const headers = new Headers()
    headers.set('Content-Type', asset.mimeType)
    headers.set('Content-Disposition', `attachment; filename="${asset.filename}"`)
    headers.set('Content-Length', asset.data.length.toString())
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')

    return new NextResponse(new Uint8Array(asset.data), {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error('Asset download error:', error)
    return NextResponse.json({ error: 'Failed to download asset' }, { status: 500 })
  }
})
