import { NextRequest, NextResponse } from 'next/server'
import { assetStore } from '@/lib/asset-store'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    const asset = assetStore.get(id)
    if (!asset) {
      return NextResponse.json(
        { error: 'Asset not found' },
        { status: 404 }
      )
    }

    // Set appropriate headers for download
    const headers = new Headers()
    headers.set('Content-Type', asset.mimeType)
    headers.set('Content-Disposition', `attachment; filename="${asset.filename}"`)
    headers.set('Content-Length', asset.data.length.toString())
    headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')

    return new NextResponse(asset.data, {
      status: 200,
      headers
    })

  } catch (error) {
    console.error('Asset download error:', error)
    return NextResponse.json(
      { error: 'Failed to download asset' },
      { status: 500 }
    )
  }
}