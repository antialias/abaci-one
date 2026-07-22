import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Locks the "paper/express lane loads zero three.js" decision (Gitea epic #5,
// CP4). The heavy 3D stack — three.js (WebGL) and, behind useAbacusScad, the
// OpenSCAD-WASM exporter — is quarantined inside AbacusStudioViewer, which the
// page pulls in ONLY through next/dynamic and mounts ONLY on the 3D-print
// target. Everything else on the /create/abacus surface is reachable by the
// paper lane and must stay light, so the far-larger no-3D-printer audience
// never downloads the WebGL chunk.
//
// A *static* import of the viewer (or of three) into any paper-path module
// would silently break that promise — the bundler would fold the heavy chunk
// into the shared entry. This guard fails loudly if that regresses. It is a
// source-level architectural guard (like the frozen 3mf/plan byte guards), not
// a behavior test: it reads the shipped source and asserts the import shape.

// Tests run with cwd = apps/web (`npx vitest run src/...`).
const WEB = process.cwd()
const ABACUS_DIR = join(WEB, 'src/components/create/abacus')
const STUDIO_DIR = join(WEB, 'src/components/studio')
const PAGE = join(WEB, 'src/app/create/abacus/page.tsx')

// The dynamic boundary: the one module allowed to touch the 3D stack.
const VIEWER = 'AbacusStudioViewer.tsx'

// A static `import … from 'three'` / 'three/…'. Anchored at line start so bare
// mentions in comments or strings, and dynamic import() expressions, don't match.
const STATIC_THREE_IMPORT = /^\s*import\b[^\n]*\bfrom\s+['"]three(?:['"/])/m
// A static import of the viewer symbol. The dynamic `import('…AbacusStudioViewer')`
// form has no `from` and doesn't start the line with `import`, so it won't match.
const STATIC_VIEWER_IMPORT = /^\s*import\b[^\n]*\bfrom\s+['"][^'"]*AbacusStudioViewer['"]/m

// App source only: exclude __tests__ and Storybook stories, which legitimately
// import components directly and never ship in the app bundle.
function appSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return e.name === '__tests__' ? [] : appSources(join(dir, e.name))
    if (!/\.(ts|tsx)$/.test(e.name)) return []
    if (e.name.endsWith('.stories.tsx')) return []
    return [join(dir, e.name)]
  })
}

const STUDIO_SURFACE = [...appSources(ABACUS_DIR), ...appSources(STUDIO_DIR)]
const base = (f: string) => f.split('/').pop() as string

describe('express lane keeps the 3D stack code-split from the paper path (Gitea epic #5)', () => {
  it('sanity: the scan actually covers the studio surface', () => {
    const names = STUDIO_SURFACE.map(base)
    expect(STUDIO_SURFACE.length).toBeGreaterThan(5)
    expect(names).toContain(VIEWER)
    expect(names).toContain('AbacusMarkerSheet.tsx') // paper realizer
    expect(names).toContain('StudioShell.tsx') // shared shell
  })

  it('only the dynamically-imported viewer statically imports three', () => {
    const offenders = STUDIO_SURFACE.filter((f) =>
      STATIC_THREE_IMPORT.test(readFileSync(f, 'utf8'))
    ).map(base)
    expect(offenders).toEqual([VIEWER])
  })

  it('no app module statically imports the viewer — it is reachable only via dynamic import()', () => {
    const offenders = [...STUDIO_SURFACE, PAGE]
      .filter((f) => STATIC_VIEWER_IMPORT.test(readFileSync(f, 'utf8')))
      .map(base)
    expect(offenders).toEqual([])
  })

  it('the page pulls the viewer through next/dynamic', () => {
    const src = readFileSync(PAGE, 'utf8')
    expect(src).toMatch(/dynamic\(\s*\(\)\s*=>\s*import\(\s*['"][^'"]*AbacusStudioViewer['"]/)
  })
})
