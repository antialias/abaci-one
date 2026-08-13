/**
 * Guards on the shared nav config. Four surfaces read this one array, so a bad
 * entry is a broken link — or a missing label — in four places at once. These
 * are the invariants the type can't state: that an href resolves to a route on
 * disk, that every locale has every label, and that `desktopFrom` and the
 * `'desktop'` surface never appear without each other (a desktop item missing
 * its breakpoint would silently fall back to `sm` and appear too early).
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { commonMessages } from '@/i18n/locales/common/messages'
import { NAV_ITEMS, type NavSurface, navItemsFor } from '../navItems'

const APP_DIR = path.resolve(__dirname, '../../app')
const SURFACES: NavSurface[] = ['drawer', 'dropdown', 'desktop', 'floating']

describe('NAV_ITEMS', () => {
  it('has unique hrefs and unique label keys', () => {
    const hrefs = NAV_ITEMS.map((i) => i.href)
    const keys = NAV_ITEMS.map((i) => i.labelKey)
    expect(new Set(hrefs).size).toBe(NAV_ITEMS.length)
    expect(new Set(keys).size).toBe(NAV_ITEMS.length)
  })

  /**
   * Nav is the most-clicked thing in the app and nothing else type-checks these
   * strings against the filesystem.
   */
  it('every href is a real route with a page.tsx on disk', () => {
    for (const item of NAV_ITEMS) {
      const dir = item.href === '/' ? '' : item.href.replace(/^\//, '')
      const pageFile = path.join(APP_DIR, dir, 'page.tsx')
      expect(existsSync(pageFile), `${item.href}: missing ${pageFile}`).toBe(true)
    }
  })

  it('declares an emoji and at least one surface for every item', () => {
    for (const item of NAV_ITEMS) {
      expect(item.emoji.length, item.href).toBeGreaterThan(0)
      expect(item.surfaces.length, item.href).toBeGreaterThan(0)
    }
  })

  it('pairs desktopFrom with the desktop surface, in both directions', () => {
    for (const item of NAV_ITEMS) {
      expect(item.surfaces.includes('desktop'), `${item.href} surfaces`).toBe(
        item.desktopFrom !== undefined
      )
    }
  })
})

describe('navItemsFor', () => {
  it('gives the drawer and the dropdown the identical list', () => {
    expect(navItemsFor('drawer')).toEqual(navItemsFor('dropdown'))
  })

  it('preserves canonical order on every surface', () => {
    const rank = new Map(NAV_ITEMS.map((item, i) => [item.href, i]))
    for (const surface of SURFACES) {
      const ranks = navItemsFor(surface).map((item) => rank.get(item.href) as number)
      expect(
        [...ranks].sort((a, b) => a - b),
        surface
      ).toEqual(ranks)
    }
  })

  /**
   * Pins the shapes the four call sites actually render today, so shrinking the
   * desktop bar or padding the floating menu is a deliberate edit to this test
   * rather than an accident.
   */
  it('shows the sets each surface is meant to show', () => {
    expect(navItemsFor('desktop').map((i) => i.href)).toEqual([
      '/create',
      '/practice',
      '/games',
      '/blog',
    ])
    expect(navItemsFor('floating').map((i) => i.href)).toEqual([
      '/',
      '/create',
      '/practice',
      '/flowchart',
      '/games',
    ])
    expect(navItemsFor('drawer')).toHaveLength(NAV_ITEMS.length)
  })

  it('reveals desktop links in widening order', () => {
    const order = ['sm', 'md', 'lg', 'xl']
    const seen = navItemsFor('desktop').map((i) => order.indexOf(i.desktopFrom ?? 'sm'))
    expect(seen).toEqual([...seen].sort((a, b) => a - b))
    expect(seen).not.toContain(-1)
  })
})

describe('nav labels', () => {
  /**
   * `NavItem.label` is never rendered — this is the only thing it is for. It
   * exists so the config stays readable on its own and so an en.json edit that
   * forgets the config (or vice versa) fails here instead of shipping.
   */
  it('matches the English label in the config to en.json', () => {
    for (const item of NAV_ITEMS) {
      expect(commonMessages.en.nav[item.labelKey as keyof typeof commonMessages.en.nav]).toBe(
        item.label
      )
    }
  })

  it.each(Object.keys(commonMessages))('%s translates every nav item', (locale) => {
    const nav = commonMessages[locale as keyof typeof commonMessages].nav
    for (const item of NAV_ITEMS) {
      const label = nav[item.labelKey as keyof typeof nav] as string | undefined
      expect(label, `${locale}.${item.labelKey}`).toBeTruthy()
      // A stray key path ("common.nav.blog") is what next-intl renders on a
      // miss, and it looks enough like a word to survive a truthiness check.
      expect(label, `${locale}.${item.labelKey}`).not.toContain('.')
    }
  })

  it('has no orphan keys left over in any locale', () => {
    const declared = new Set(NAV_ITEMS.map((i) => i.labelKey))
    for (const [locale, messages] of Object.entries(commonMessages)) {
      expect(Object.keys(messages.nav).sort(), locale).toEqual([...declared].sort())
    }
  })
})
