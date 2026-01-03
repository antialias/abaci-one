// File-based asset store for generated files
import * as fs from 'fs'
import * as path from 'path'
import { promisify } from 'util'

const writeFile = promisify(fs.writeFile)
const readFile = promisify(fs.readFile)
const unlink = promisify(fs.unlink)
const readdir = promisify(fs.readdir)
const stat = promisify(fs.stat)

export interface StoredAsset {
  data: Buffer
  filename: string
  mimeType: string
  createdAt: Date
}

// Use temp directory for storing generated assets
const ASSETS_DIR = path.join(process.cwd(), '.tmp/assets')

// Ensure assets directory exists
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true })
}

export const assetStore = {
  async set(id: string, asset: StoredAsset): Promise<void> {
    const assetPath = path.join(ASSETS_DIR, `${id}.bin`)
    const metaPath = path.join(ASSETS_DIR, `${id}.meta.json`)

    // Store binary data
    await writeFile(assetPath, asset.data)

    // Store metadata
    const metadata = {
      filename: asset.filename,
      mimeType: asset.mimeType,
      createdAt: asset.createdAt.toISOString(),
    }
    await writeFile(metaPath, JSON.stringify(metadata))
    console.log('💾 Asset stored to file:', assetPath)
  },

  async get(id: string): Promise<StoredAsset | undefined> {
    const assetPath = path.join(ASSETS_DIR, `${id}.bin`)
    const metaPath = path.join(ASSETS_DIR, `${id}.meta.json`)

    try {
      const data = await readFile(assetPath)
      const metaData = JSON.parse(await readFile(metaPath, 'utf-8'))

      return {
        data,
        filename: metaData.filename,
        mimeType: metaData.mimeType,
        createdAt: new Date(metaData.createdAt),
      }
    } catch (_error) {
      console.log('❌ Asset not found in file system:', assetPath)
      return undefined
    }
  },

  async keys(): Promise<string[]> {
    try {
      const files = await readdir(ASSETS_DIR)
      return files.filter((f) => f.endsWith('.bin')).map((f) => f.replace('.bin', ''))
    } catch {
      return []
    }
  },

  get size(): number {
    try {
      return fs.readdirSync(ASSETS_DIR).filter((f) => f.endsWith('.bin')).length
    } catch {
      return 0
    }
  },
}

// Clean up old assets every hour
setInterval(
  async () => {
    const cutoff = Date.now() - 60 * 60 * 1000 // 1 hour ago
    try {
      const files = await readdir(ASSETS_DIR)
      for (const file of files) {
        if (!file.endsWith('.bin')) continue

        const filePath = path.join(ASSETS_DIR, file)
        const stats = await stat(filePath)

        if (stats.mtime.getTime() < cutoff) {
          const id = file.replace('.bin', '')
          await unlink(filePath).catch(() => {})
          await unlink(path.join(ASSETS_DIR, `${id}.meta.json`)).catch(() => {})
          console.log('🗑️ Cleaned up old asset:', id)
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up assets:', error)
    }
  },
  60 * 60 * 1000
)
