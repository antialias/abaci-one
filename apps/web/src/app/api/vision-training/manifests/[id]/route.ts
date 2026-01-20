import { promises as fs } from 'fs'
import path from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

// Manifest storage directory
const MANIFESTS_DIR = path.join(process.cwd(), 'data/vision-training/manifests')

/**
 * GET /api/vision-training/manifests/[id]
 *
 * Get a manifest by ID.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  if (!id) {
    return new Response(JSON.stringify({ error: 'Manifest ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const manifestPath = path.join(MANIFESTS_DIR, `${id}.json`)

  try {
    const content = await fs.readFile(manifestPath, 'utf-8')
    const manifest = JSON.parse(content)

    return new Response(JSON.stringify(manifest), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return new Response(JSON.stringify({ error: 'Manifest not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    console.error(`[Manifests API] Error reading manifest ${id}:`, error)
    return new Response(
      JSON.stringify({ error: 'Failed to read manifest', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * DELETE /api/vision-training/manifests/[id]
 *
 * Delete a manifest by ID.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params

  if (!id) {
    return new Response(JSON.stringify({ error: 'Manifest ID is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const manifestPath = path.join(MANIFESTS_DIR, `${id}.json`)

  try {
    await fs.unlink(manifestPath)

    return new Response(JSON.stringify({ success: true, message: 'Manifest deleted' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      // Already deleted - return success
      return new Response(
        JSON.stringify({ success: true, message: 'Manifest already deleted or does not exist' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.error(`[Manifests API] Error deleting manifest ${id}:`, error)
    return new Response(
      JSON.stringify({ error: 'Failed to delete manifest', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
