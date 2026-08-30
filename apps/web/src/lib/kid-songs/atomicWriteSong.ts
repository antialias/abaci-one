import { randomBytes } from 'node:crypto'
import { open, rename, unlink } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

interface AtomicWriteOperations {
  open: typeof open
  rename: typeof rename
  unlink: typeof unlink
}

const defaultOperations: AtomicWriteOperations = { open, rename, unlink }

export async function atomicWriteSong(
  path: string,
  bytes: Buffer,
  operations: AtomicWriteOperations = defaultOperations
): Promise<void> {
  const tempPath = join(
    dirname(path),
    `.${basename(path)}.${process.pid}.${randomBytes(8).toString('hex')}.tmp`
  )
  let handle: Awaited<ReturnType<typeof open>> | null = null
  try {
    handle = await operations.open(tempPath, 'wx', 0o600)
    await handle.writeFile(bytes)
    await handle.close()
    handle = null
    await operations.rename(tempPath, path)
  } finally {
    await handle?.close().catch(() => undefined)
    await operations.unlink(tempPath).catch(() => undefined)
  }
}
