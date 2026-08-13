/**
 * The one list of app-navigation destinations.
 *
 * Four surfaces render app nav: the hamburger drawer and the desktop dropdown
 * (both inside `AppNavBar`), the handful of always-visible links in that same
 * bar, and the standalone `FloatingHamburgerMenu` used on distraction-free
 * pages. Before this file each kept its own hardcoded array, and they had
 * already drifted — the floating menu showed 🏠/🎯 where the drawer showed
 * 🧮/📚 for the very same two routes.
 *
 * Surfaces may now differ in *which* items they show and nothing else: a
 * route's href, emoji, and label come from here for everyone.
 *
 * Deliberately free of JSX and styled-system imports so a server component, or
 * a test that walks the filesystem looking for the route on disk, can import
 * it. The Panda classes that implement `desktopFrom` live in `AppNavBar.tsx`,
 * because Panda can only extract responsive keys it can see statically.
 */

/** Where a nav item can appear. */
export type NavSurface =
  /** The full-screen mobile drawer inside `AppNavBar`. */
  | 'drawer'
  /** The desktop dropdown inside `AppNavBar`. */
  | 'dropdown'
  /** The always-visible links in the desktop bar (space-constrained). */
  | 'desktop'
  /** The standalone `FloatingHamburgerMenu` on distraction-free pages. */
  | 'floating'

/**
 * The breakpoint at which a desktop-bar link becomes visible. The bar reveals
 * links progressively as the viewport widens, so each item declares its own
 * threshold rather than the bar hardcoding four `<div>` wrappers.
 */
export type NavDesktopBreakpoint = 'sm' | 'md' | 'lg' | 'xl'

export interface NavItem {
  href: string
  /** Key under the `common.nav` namespace. */
  labelKey: string
  /**
   * English label. Not a fallback the app renders — `navItems.test.ts` asserts
   * it equals `en.common.nav[labelKey]`, which is what stops the config and the
   * locale files from drifting apart silently.
   */
  label: string
  emoji: string
  /** Present iff `surfaces` includes `'desktop'`. */
  desktopFrom?: NavDesktopBreakpoint
  surfaces: readonly NavSurface[]
}

const ALL_MENUS = ['drawer', 'dropdown'] as const

/**
 * Canonical order. Every surface renders its items in this order, which is how
 * the drawer, the dropdown, the desktop bar, and the floating menu stay in
 * agreement about what comes first.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    href: '/',
    labelKey: 'home',
    label: 'Home',
    emoji: '🧮',
    surfaces: [...ALL_MENUS, 'floating'],
  },
  {
    href: '/create',
    labelKey: 'create',
    label: 'Create',
    emoji: '✏️',
    desktopFrom: 'sm',
    surfaces: [...ALL_MENUS, 'desktop', 'floating'],
  },
  {
    href: '/practice',
    labelKey: 'practice',
    label: 'Practice',
    emoji: '📚',
    desktopFrom: 'md',
    surfaces: [...ALL_MENUS, 'desktop', 'floating'],
  },
  {
    href: '/my-stuff',
    labelKey: 'myStuff',
    label: 'My Stuff',
    emoji: '⭐',
    surfaces: ALL_MENUS,
  },
  {
    href: '/flowchart',
    labelKey: 'flowcharts',
    label: 'Flowcharts',
    emoji: '🗺️',
    surfaces: [...ALL_MENUS, 'floating'],
  },
  {
    href: '/games',
    labelKey: 'games',
    label: 'Games',
    emoji: '🎮',
    desktopFrom: 'lg',
    surfaces: [...ALL_MENUS, 'desktop', 'floating'],
  },
  {
    href: '/toys',
    labelKey: 'toys',
    label: 'Toys',
    emoji: '🧸',
    surfaces: ALL_MENUS,
  },
  {
    href: '/guide',
    labelKey: 'guide',
    label: 'Guide',
    emoji: '📖',
    surfaces: ALL_MENUS,
  },
  {
    href: '/blog',
    labelKey: 'blog',
    label: 'Blog',
    emoji: '📝',
    desktopFrom: 'xl',
    surfaces: [...ALL_MENUS, 'desktop'],
  },
] as const

/** The items one surface shows, in canonical order. */
export function navItemsFor(surface: NavSurface): NavItem[] {
  return NAV_ITEMS.filter((item) => item.surfaces.includes(surface))
}
