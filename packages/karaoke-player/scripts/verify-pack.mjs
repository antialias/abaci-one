import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const temporaryDirectory = mkdtempSync(join(tmpdir(), 'karaoke-player-pack-'))

try {
  const packResult = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--json', '--ignore-scripts', '--pack-destination', temporaryDirectory],
      { encoding: 'utf8' }
    )
  )[0]
  const fileNames = new Set(packResult.files.map((file) => file.path))
  for (const required of [
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/styles.css',
    'README.md',
  ]) {
    if (!fileNames.has(required)) throw new Error(`Packed artifact is missing ${required}`)
  }

  const moduleRoot = new URL('../', import.meta.url)
  const esm = await import(new URL('dist/index.js', moduleRoot))
  if (typeof esm.KaraokePlayer !== 'function') throw new Error('ESM KaraokePlayer export missing')
  if (typeof esm.buildSyncedLyricsModel !== 'function') {
    throw new Error('ESM alignment export missing')
  }

  const require = createRequire(import.meta.url)
  const commonJs = require(fileURLToPath(new URL('dist/index.cjs', moduleRoot)))
  if (typeof commonJs.KaraokePlayer !== 'function') {
    throw new Error('CommonJS KaraokePlayer export missing')
  }

  const peerRange = packResult.peerDependencies ?? null
  console.log(
    `Verified ${packResult.filename}: ${packResult.files.length} files, ESM/CJS/types/CSS exports present`,
    peerRange ?? ''
  )
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true })
}
