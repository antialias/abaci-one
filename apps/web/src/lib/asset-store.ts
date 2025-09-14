// Shared asset store for generated files
// In production, this should be replaced with Redis or a database

export interface StoredAsset {
  data: Buffer
  filename: string
  mimeType: string
  createdAt: Date
}

export const assetStore = new Map<string, StoredAsset>()

// Clean up old assets every hour
setInterval(() => {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000) // 1 hour ago
  const entries = Array.from(assetStore.entries())
  entries.forEach(([id, asset]) => {
    if (asset.createdAt < cutoff) {
      assetStore.delete(id)
    }
  })
}, 60 * 60 * 1000)