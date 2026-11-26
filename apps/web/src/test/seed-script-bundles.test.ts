/**
 * @vitest-environment node
 *
 * The production build runs `build:seed-script`: esbuild bundles
 * `scripts/seedTestStudents.ts` with packages external. Phase 4a broke that
 * build (and so the deploy) by making `row-cas` import the socket server,
 * whose graph reaches page components and their Panda CSS imports, which
 * esbuild cannot resolve. The unit gate never ran the bundle; this does,
 * with the same options as the package script.
 */

import path from 'node:path'
import { build } from 'esbuild'
import { describe, expect, it } from 'vitest'

const APP = path.resolve(__dirname, '../..')

describe('seed script bundle', () => {
  it('bundles with the options build:seed-script uses', async () => {
    const result = await build({
      absWorkingDir: APP,
      entryPoints: ['scripts/seedTestStudents.ts'],
      bundle: true,
      platform: 'node',
      packages: 'external',
      write: false,
      metafile: true,
      logLevel: 'silent',
    })

    expect(result.errors).toEqual([])
    // Nothing from the UI side: no page components, no arcade games
    const inputs = Object.keys(result.metafile.inputs)
    expect(inputs.filter((f) => /^src\/(components|arcade-games)\//.test(f))).toEqual([])
  }, 60_000)
})
