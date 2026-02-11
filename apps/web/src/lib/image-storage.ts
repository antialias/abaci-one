import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { readFile } from 'fs/promises'
import { dirname, join } from 'path'

export type ImageStorageTarget =
  | { type: 'static'; relativePath: string }
  | { type: 'persistent'; category: string; filename: string }

const PUBLIC_DIR = join(process.cwd(), 'public')
const PERSISTENT_DIR = join(process.cwd(), 'data', 'generated-images')

function resolvePath(target: ImageStorageTarget): string {
  if (target.type === 'static') {
    return join(PUBLIC_DIR, target.relativePath)
  }
  return join(PERSISTENT_DIR, target.category, target.filename)
}

function resolvePublicUrl(target: ImageStorageTarget): string {
  if (target.type === 'static') {
    return `/${target.relativePath}`
  }
  return `/api/images/${target.category}/${target.filename}`
}

export function storeImage(
  target: ImageStorageTarget,
  buffer: Buffer
): { publicUrl: string; sizeBytes: number } {
  const filePath = resolvePath(target)
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, buffer)
  return { publicUrl: resolvePublicUrl(target), sizeBytes: buffer.byteLength }
}

export function imageExists(target: ImageStorageTarget): boolean {
  return existsSync(resolvePath(target))
}

export async function readPersistentImage(
  category: string,
  filename: string
): Promise<{ buffer: Buffer; sizeBytes: number } | null> {
  const filePath = join(PERSISTENT_DIR, category, filename)
  try {
    const buffer = await readFile(filePath)
    return { buffer, sizeBytes: buffer.byteLength }
  } catch {
    return null
  }
}
