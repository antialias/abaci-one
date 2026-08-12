/**
 * The hub's structural contract: one card per registry entry, exactly one link
 * per card (the tile-wide hit area is a pseudo-element, not a second anchor),
 * a clean h1 → h2 → h3 outline, and every card showing its real captured
 * artifact with the intrinsic box reserved up front.
 *
 * Note on image assertions: the global test setup intercepts `src`/`width`/
 * `height` on <img> to stop jsdom decoding through canvas, so those read back
 * as PROPERTIES and `getAttribute` returns null for them. Attributes it doesn't
 * touch (`alt`, `loading`) are assertable normally.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { CREATE_TOOLS } from '@/lib/create-tools/createToolList'
import { CreateHubContent } from '../CreateHubContent'

// The nav pulls in session/query/arcade machinery that has nothing to do with
// the hub's layout; the hub only depends on it for the nav-height offset.
vi.mock('@/components/PageWithNav', () => ({
  PageWithNav: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// next-intl is globally mocked in test setup to echo the key back, so these
// assertions are about STRUCTURE — copy correctness is covered by the i18n
// completeness suite instead.
function renderHub() {
  return render(<CreateHubContent />)
}

describe('CreateHubContent', () => {
  it('renders one card per registered tool, in tier order', () => {
    renderHub()
    const cards = document.querySelectorAll('[data-element="create-tool-card"]')
    expect(cards).toHaveLength(CREATE_TOOLS.length)

    const primary = document.querySelectorAll('[data-tier="primary"][data-tool-id]')
    const secondary = document.querySelectorAll('[data-tier="secondary"][data-tool-id]')
    expect([...primary].map((c) => c.getAttribute('data-tool-id'))).toEqual([
      'abacus',
      'worksheets',
      'flashcards',
    ])
    expect([...secondary].map((c) => c.getAttribute('data-tool-id'))).toEqual([
      'calendar',
      'music-flashcards',
    ])
  })

  it('gives every card exactly one link, pointing at that tool', () => {
    renderHub()
    for (const tool of CREATE_TOOLS) {
      const card = document.querySelector<HTMLElement>(`[data-tool-id="${tool.id}"]`)
      expect(card, tool.id).not.toBeNull()
      const links = within(card as HTMLElement).getAllByRole('link')
      expect(links, `${tool.id} should have a single link`).toHaveLength(1)
      expect(links[0]).toHaveAttribute('href', tool.href)
      // and it must have an accessible name — the tile overlay is decorative
      expect(links[0].textContent?.trim().length).toBeGreaterThan(0)
    }
  })

  it('keeps a single h1 and puts tool titles below the section heading', () => {
    renderHub()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(CREATE_TOOLS.length)
  })

  it("shows each tool's captured artifact, described and sized from the registry", () => {
    renderHub()
    const slots = document.querySelectorAll('[data-element="create-tool-preview"]')
    expect(slots).toHaveLength(CREATE_TOOLS.length)

    for (const tool of CREATE_TOOLS) {
      const card = document.querySelector<HTMLElement>(`[data-tool-id="${tool.id}"]`)
      const img = card?.querySelector('img')
      expect(img, `${tool.id} preview`).not.toBeNull()
      // next/image routes through the optimizer, so the registry path is the
      // `url` param rather than the src itself
      const optimized = new URL(img?.src as string, 'http://localhost')
      expect(optimized.searchParams.get('url'), tool.id).toBe(tool.preview.src)
      // properties, not attributes — see the note at the top of this file
      expect(img?.width, tool.id).toBe(tool.preview.width)
      expect(img?.height, tool.id).toBe(tool.preview.height)
      // the artifact IS the content here, so it carries a real description
      expect(img).toHaveAttribute('alt', tool.preview.alt)
    }
  })

  it('marks exactly one card as the flagship, and only it gets an eyebrow', () => {
    renderHub()
    const flagship = document.querySelector<HTMLElement>('[data-variant="flagship"]')
    expect(flagship).not.toBeNull()
    expect(document.querySelectorAll('[data-variant="flagship"]')).toHaveLength(1)
    expect(flagship).toHaveAttribute('data-tool-id', 'abacus')

    const eyebrows = document.querySelectorAll('[data-element="create-tool-eyebrow"]')
    expect(eyebrows).toHaveLength(1)
    expect(flagship?.contains(eyebrows[0])).toBe(true)
  })

  it('prioritises the whole primary row and lazy-loads only the secondary one', () => {
    renderHub()
    const attrsIn = (tier: string, attr: string) =>
      [...document.querySelectorAll(`[data-tier="${tier}"][data-tool-id] img`)].map((i) =>
        i.getAttribute(attr)
      )

    // next/image drops `loading` entirely for a priority image, so a null here
    // is what "preloaded, definitely not deferred" looks like.
    expect(attrsIn('primary', 'loading')).toEqual([null, null, null])
    expect(attrsIn('primary', 'fetchpriority')).toEqual(['high', 'high', 'high'])

    expect(attrsIn('secondary', 'loading')).toEqual(['lazy', 'lazy'])
    expect(attrsIn('secondary', 'fetchpriority')).toEqual([null, null])
  })
})
