import { NextRequest, NextResponse } from 'next/server'
import { assetStore } from '@/lib/asset-store'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    console.log('🔍 Looking for asset:', id)
    console.log('📦 Available assets:', Array.from(assetStore.keys()))

    // Get asset from store
    const asset = assetStore.get(id)
    if (!asset) {
      console.log('❌ Asset not found in store')
      return NextResponse.json({
        error: 'Asset not found or expired'
      }, { status: 404 })
    }

    console.log('✅ Asset found, serving download')

    // Return file with appropriate headers
    return new NextResponse(asset.data, {
      status: 200,
      headers: {
        'Content-Type': asset.mimeType,
        'Content-Disposition': `attachment; filename="${asset.filename}"`,
        'Content-Length': asset.data.length.toString(),
        'Cache-Control': 'private, no-cache, no-store, must-revalidate',
        'Expires': '0',
        'Pragma': 'no-cache'
      }
    })

  } catch (error) {
    console.error('❌ Download failed:', error)
    return NextResponse.json({
      error: 'Failed to download file'
    }, { status: 500 })
  }
}