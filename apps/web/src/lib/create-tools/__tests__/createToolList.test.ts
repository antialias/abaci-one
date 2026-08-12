/**
 * Registry integrity. These are the invariants a type can't express: that a
 * declared `href` actually resolves to a route on disk, that ids and preview
 * ids don't collide, and that the SEO strings stay inside the lengths search
 * engines render. The hub, the sitemap, the per-route metadata, and the
 * cross-link chips all read this one array, so a bad entry is a broken link in
 * four places at once.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  CREATE_TOOL_HREF,
  CREATE_TOOLS,
  type CreateToolId,
  getCreateTool,
  getCreateToolsByTier,
  getOtherCreateTools,
} from '../createToolList'

const APP_DIR = path.resolve(__dirname, '../../../app')
const PUBLIC_DIR = path.resolve(__dirname, '../../../../public')

describe('CREATE_TOOLS registry', () => {
  it('has unique ids, hrefs and preview images', () => {
    const ids = CREATE_TOOLS.map((t) => t.id)
    const hrefs = CREATE_TOOLS.map((t) => t.href)
    const previews = CREATE_TOOLS.map((t) => t.preview.src)
    expect(new Set(ids).size).toBe(CREATE_TOOLS.length)
    expect(new Set(hrefs).size).toBe(CREATE_TOOLS.length)
    expect(new Set(previews).size).toBe(CREATE_TOOLS.length)
  })

  /**
   * The previews are captured artifacts committed under `public/`, not code, so
   * nothing else would notice a file being renamed or a capture never being
   * run — the card would just render a broken image.
   */
  it('every preview image exists on disk with the dimensions the registry claims', async () => {
    const sharp = (await import('sharp')).default
    for (const tool of CREATE_TOOLS) {
      const file = path.join(PUBLIC_DIR, tool.preview.src.replace(/^\//, ''))
      expect(existsSync(file), `${tool.id}: missing ${file}`).toBe(true)

      const { width, height } = await sharp(file).metadata()
      expect({ id: tool.id, width, height }).toEqual({
        id: tool.id,
        width: tool.preview.width,
        height: tool.preview.height,
      })
    }
  })

  it('describes every preview for screen readers', () => {
    for (const tool of CREATE_TOOLS) {
      expect(tool.preview.alt.length, `${tool.id} alt`).toBeGreaterThan(20)
    }
  })

  it('every href is a real /create route with a page.tsx on disk', () => {
    for (const tool of CREATE_TOOLS) {
      expect(tool.href.startsWith('/create/')).toBe(true)
      const pageFile = path.join(APP_DIR, tool.href.replace(/^\//, ''), 'page.tsx')
      expect(existsSync(pageFile), `${tool.id}: missing ${pageFile}`).toBe(true)
    }
  })

  it('is 3 primary + 2 secondary, each tier ordered without gaps or ties', () => {
    const primary = getCreateToolsByTier('primary')
    const secondary = getCreateToolsByTier('secondary')
    expect(primary).toHaveLength(3)
    expect(secondary).toHaveLength(2)
    for (const tier of [primary, secondary]) {
      expect(tier.map((t) => t.order)).toEqual(tier.map((_, i) => i))
    }
  })

  it('leads the primary row with the abacus studio (the flagship)', () => {
    expect(getCreateToolsByTier('primary')[0]?.id).toBe('abacus')
  })

  it('declares SEO strings that fit a <title> and a meta description', () => {
    for (const tool of CREATE_TOOLS) {
      expect(tool.seo.title.length, `${tool.id} title`).toBeGreaterThan(0)
      expect(tool.seo.title.length, `${tool.id} title`).toBeLessThanOrEqual(70)
      expect(tool.seo.description.length, `${tool.id} description`).toBeGreaterThan(0)
      expect(tool.seo.description.length, `${tool.id} description`).toBeLessThanOrEqual(160)
    }
  })

  it('declares at least one feature per tool (the card renders featureCount keys)', () => {
    for (const tool of CREATE_TOOLS) {
      expect(tool.featureCount).toBeGreaterThan(0)
    }
  })
})

describe('registry helpers', () => {
  it('getCreateTool round-trips every id, and is undefined for an unknown one', () => {
    for (const tool of CREATE_TOOLS) {
      expect(getCreateTool(tool.id)).toBe(tool)
    }
    expect(getCreateTool('nope' as CreateToolId)).toBeUndefined()
  })

  it('getOtherCreateTools omits the current tool and puts primary tools first', () => {
    const others = getOtherCreateTools('calendar')
    expect(others).toHaveLength(CREATE_TOOLS.length - 1)
    expect(others.some((t) => t.id === 'calendar')).toBe(false)
    // primary trio ahead of the remaining secondary tool
    expect(others.map((t) => t.tier)).toEqual(['primary', 'primary', 'primary', 'secondary'])
  })

  // CREATE_TOOL_HREF is built with an `as Record<CreateToolId, string>` cast so
  // link sites don't need a null check. This is what makes that cast honest.
  it('CREATE_TOOL_HREF covers every id and nothing else', () => {
    expect(Object.keys(CREATE_TOOL_HREF).sort()).toEqual(CREATE_TOOLS.map((t) => t.id).sort())
    for (const tool of CREATE_TOOLS) {
      expect(CREATE_TOOL_HREF[tool.id], tool.id).toBe(tool.href)
    }
  })
})

describe('sitemap coverage', () => {
  it('lists every create tool exactly once, tiered by priority', async () => {
    const { default: sitemap } = await import('@/app/sitemap')
    const entries = sitemap()

    for (const tool of CREATE_TOOLS) {
      const matches = entries.filter((e) => e.url === `https://abaci.one${tool.href}`)
      expect(matches, tool.id).toHaveLength(1)
      expect(matches[0].priority, tool.id).toBe(tool.tier === 'primary' ? 0.8 : 0.6)
    }
    // the hub itself must still be there
    expect(entries.some((e) => e.url === 'https://abaci.one/create')).toBe(true)
  })
})
