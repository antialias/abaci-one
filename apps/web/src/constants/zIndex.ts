/**
 * Z-index layering system for the application.
 *
 * Organized into logical layers to prevent z-index conflicts.
 * Higher numbers appear on top.
 */

export const Z_INDEX = {
  // Base content layer (0-99)
  BASE: 0,
  CONTENT: 1,

  // Navigation and UI chrome (100-999)
  NAV_BAR: 100,
  STICKY_HEADER: 100,
  SUB_NAV: 90,
  SESSION_MODE_BANNER: 85, // Below sub-nav, but above content
  SESSION_MODE_BANNER_ANIMATING: 150, // Above all nav during FLIP animation

  // Overlays and dropdowns (1000-9999)
  DROPDOWN: 1000,
  TOOLTIP: 1000,
  POPOVER: 1000,

  // Modal and dialog layers (10000-19999)
  MODAL_BACKDROP: 10000,
  MODAL: 10001,

  // Top-level overlays (20000+)
  TOAST: 20000,

  // My Abacus - Personal trophy overlay (30000+)
  MY_ABACUS_BACKDROP: 30000,
  MY_ABACUS: 30001,

  // Special navigation layers for game pages
  GAME_NAV: {
    // Hamburger menu and its nested content
    HAMBURGER_MENU: 9999,
    HAMBURGER_NESTED_DROPDOWN: 10000, // Must be above hamburger menu
  },

  // Game-specific layers
  GAME: {
    HUD: 100,
    OVERLAY: 1000,
    PLAYER_AVATAR: 1000, // Multiplayer presence indicators
  },
} as const

// Helper function to get z-index value
export function getZIndex(path: string): number {
  const parts = path.split('.')
  let value: any = Z_INDEX

  for (const part of parts) {
    value = value[part]
    if (value === undefined) {
      console.warn(`[zIndex] Unknown path: ${path}`)
      return 0
    }
  }

  return typeof value === 'number' ? value : 0
}
