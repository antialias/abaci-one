import { createId } from '@paralleldrive/cuid2'
import { promises as fs } from 'fs'
import path from 'path'

// Force dynamic rendering
export const dynamic = 'force-dynamic'

/**
 * Manifest item for column classifier
 */
interface ColumnManifestItem {
  type: 'column'
  digit: number
  filename: string
}

/**
 * Manifest item for boundary detector
 */
interface BoundaryManifestItem {
  type: 'boundary'
  deviceId: string
  baseName: string
}

type ManifestItem = ColumnManifestItem | BoundaryManifestItem

/**
 * Training manifest schema
 */
interface TrainingManifest {
  id: string
  modelType: 'column-classifier' | 'boundary-detector'
  createdAt: string
  filters: {
    captureType?: 'passive' | 'explicit' | 'all'
    deviceId?: string
    digit?: number // column-classifier only
  }
  items: ManifestItem[]
}

// Manifest storage directory
const MANIFESTS_DIR = path.join(process.cwd(), 'data/vision-training/manifests')

/**
 * Ensure the manifests directory exists
 */
async function ensureManifestsDir(): Promise<void> {
  try {
    await fs.mkdir(MANIFESTS_DIR, { recursive: true })
  } catch {
    // Directory may already exist
  }
}

/**
 * POST /api/vision-training/manifests
 *
 * Create a new training manifest from filtered items.
 *
 * Request body:
 * {
 *   modelType: 'column-classifier' | 'boundary-detector',
 *   filters: { captureType?, deviceId?, digit? },
 *   items: ManifestItem[]
 * }
 *
 * Response:
 * {
 *   manifestId: string,
 *   itemCount: number
 * }
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = await request.json()
    const { modelType, filters, items } = body

    // Validate required fields
    if (!modelType || !['column-classifier', 'boundary-detector'].includes(modelType)) {
      return new Response(
        JSON.stringify({
          error: 'Invalid modelType. Must be "column-classifier" or "boundary-detector".',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Items array is required and must not be empty.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate items based on model type
    for (const item of items) {
      if (modelType === 'column-classifier') {
        if (
          item.type !== 'column' ||
          typeof item.digit !== 'number' ||
          typeof item.filename !== 'string'
        ) {
          return new Response(
            JSON.stringify({
              error: 'Invalid column manifest item. Required: type="column", digit, filename.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }
      } else if (modelType === 'boundary-detector') {
        if (
          item.type !== 'boundary' ||
          typeof item.deviceId !== 'string' ||
          typeof item.baseName !== 'string'
        ) {
          return new Response(
            JSON.stringify({
              error:
                'Invalid boundary manifest item. Required: type="boundary", deviceId, baseName.',
            }),
            { status: 400, headers: { 'Content-Type': 'application/json' } }
          )
        }
      }
    }

    // Create manifest
    const manifestId = createId()
    const manifest: TrainingManifest = {
      id: manifestId,
      modelType,
      createdAt: new Date().toISOString(),
      filters: filters || {},
      items,
    }

    // Ensure directory exists and write manifest
    await ensureManifestsDir()
    const manifestPath = path.join(MANIFESTS_DIR, `${manifestId}.json`)
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8')

    return new Response(
      JSON.stringify({
        manifestId,
        itemCount: items.length,
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Manifests API] Error creating manifest:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to create manifest', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}

/**
 * GET /api/vision-training/manifests
 *
 * List all manifests, optionally filtered by modelType.
 *
 * Query params:
 * - modelType (optional): Filter by model type
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url)
    const modelTypeFilter = searchParams.get('modelType')

    await ensureManifestsDir()

    // Read all manifest files
    const files = await fs.readdir(MANIFESTS_DIR)
    const manifests: TrainingManifest[] = []

    for (const file of files) {
      if (!file.endsWith('.json')) continue

      try {
        const content = await fs.readFile(path.join(MANIFESTS_DIR, file), 'utf-8')
        const manifest = JSON.parse(content) as TrainingManifest

        // Apply model type filter if specified
        if (modelTypeFilter && manifest.modelType !== modelTypeFilter) {
          continue
        }

        manifests.push(manifest)
      } catch {
        // Skip invalid files
        console.warn(`[Manifests API] Skipping invalid manifest file: ${file}`)
      }
    }

    // Sort by creation date (newest first)
    manifests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return new Response(
      JSON.stringify({
        manifests: manifests.map((m) => ({
          id: m.id,
          modelType: m.modelType,
          createdAt: m.createdAt,
          itemCount: m.items.length,
          filters: m.filters,
        })),
      }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Manifests API] Error listing manifests:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to list manifests', details: String(error) }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
