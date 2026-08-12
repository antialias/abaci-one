/**
 * The /create tool registry — server-safe metadata for every printable/creator tool.
 *
 * Deliberately free of JSX and styled-system imports so it can be read from
 * `sitemap.ts`, server `layout.tsx` metadata exports, and vitest without
 * dragging a client bundle along.
 *
 * Not zod-validated: the data is static and in-repo, so a schema would only
 * restate the TypeScript type. `__tests__/createToolList.test.ts` asserts the
 * things a schema *can't* — that every `href` has a real `page.tsx` on disk,
 * that ids are unique, that every preview file exists, that SEO strings fit in
 * a <title>.
 */

export type CreateToolId = 'abacus' | 'worksheets' | 'flashcards' | 'calendar' | 'music-flashcards'

export type CreateToolTier = 'primary' | 'secondary'

/**
 * The image on a tool's card.
 *
 * Every one of these is a REAL artifact — the actual output of that tool's own
 * generator (Typst, jsPDF, or the studio's three.js viewer), captured by
 * `scripts/capture-create-previews.mjs` and committed. Hand-drawn mock-ups are
 * not allowed here: the hub's whole claim is "this is what you get", and an
 * approximation quietly makes that claim false. Re-run the script when a
 * generator's output changes.
 *
 * Intrinsic `width`/`height` are recorded so a card can reserve the exact box
 * before the image loads, which is what keeps CLS at zero.
 */
export interface CreateToolPreview {
  src: string
  width: number
  height: number
  /** `paper` = a printed sheet; `render` = a screenshot of the studio viewer. */
  kind: 'paper' | 'render'
  /**
   * Colour behind the artifact. Cards use one frame shape per row so their
   * titles line up, and the artifacts don't all share that shape — this is what
   * makes the leftover margin invisible instead of a visible letterbox. Match
   * it to the capture's own backdrop: white for a printed sheet, the viewer's
   * background for a render.
   */
  background: string
  /** English-only, for the same reason as `seo` below. */
  alt: string
}

/** The card's colorway. Lifted verbatim from the old inline `cardThemes`. */
export interface CreateToolTheme {
  gradient: string
  shadowColor: string
  checkBg: string
  checkColor: string
}

export interface CreateToolMeta {
  id: CreateToolId
  href: string
  emoji: string
  /** `primary` = the abacus-centric trio; `secondary` = the "More printables" row. */
  tier: CreateToolTier
  /** Sort order WITHIN a tier. */
  order: number
  status: 'stable' | 'beta'
  preview: CreateToolPreview
  /** Key root under the `create.hub` namespace (historical names, not always the id). */
  i18nKey: string
  /** How many `featureN` keys this tool's i18n block defines. */
  featureCount: number
  theme: CreateToolTheme
  /**
   * English-only. There is no `[locale]` URL segment (locale is cookie-driven),
   * so per-locale <head> metadata and sitemap entries aren't addressable —
   * these strings are intentionally not translated.
   */
  seo: {
    title: string
    description: string
  }
}

export const CREATE_TOOLS: readonly CreateToolMeta[] = [
  {
    id: 'abacus',
    href: '/create/abacus',
    emoji: '🧮',
    tier: 'primary',
    order: 0,
    status: 'stable',
    preview: {
      src: '/images/create-previews/abacus.webp',
      width: 1099,
      height: 687,
      kind: 'render',
      background: '#14181b',
      alt: 'The studio\u2019s 3D print preview of a four-column abacus, with ArUco markers on each corner and complement facts printed down the frame.',
    },
    i18nKey: 'visionAbacus',
    featureCount: 3,
    theme: {
      gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
      shadowColor: 'rgba(6, 182, 212, 0.4)',
      checkBg: 'cyan.100',
      checkColor: 'cyan.600',
    },
    seo: {
      title: 'Abacus Studio — Design a Real Abacus',
      description:
        'Design your own soroban and 3D-print it with camera markers baked in, or add stick-on markers to an abacus you already own.',
    },
  },
  {
    id: 'worksheets',
    href: '/create/worksheets',
    emoji: '📝',
    tier: 'primary',
    order: 1,
    status: 'stable',
    preview: {
      src: '/images/create-previews/worksheets.webp',
      width: 1600,
      height: 1237,
      kind: 'paper',
      background: '#ffffff',
      alt: 'A generated addition worksheet: twelve two-digit problems with place-value colors, carry boxes and ten-frames.',
    },
    i18nKey: 'worksheets',
    featureCount: 3,
    theme: {
      gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      shadowColor: 'rgba(16, 185, 129, 0.4)',
      checkBg: 'green.100',
      checkColor: 'green.600',
    },
    seo: {
      title: 'Addition Worksheet Creator',
      description:
        'Generate printable double-digit addition worksheets with tunable difficulty, progressive regrouping, and optional carry boxes.',
    },
  },
  {
    id: 'flashcards',
    href: '/create/flashcards',
    emoji: '🃏',
    tier: 'primary',
    order: 2,
    status: 'stable',
    preview: {
      src: '/images/create-previews/flashcards.webp',
      width: 1122,
      height: 957,
      kind: 'paper',
      background: '#ffffff',
      alt: 'A generated flashcard sheet showing two-column abacus bead patterns, four cards to a page.',
    },
    i18nKey: 'flashcards',
    featureCount: 3,
    theme: {
      gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      shadowColor: 'rgba(102, 126, 234, 0.4)',
      checkBg: 'purple.100',
      checkColor: 'purple.600',
    },
    seo: {
      title: 'Abacus Flashcard Creator',
      description:
        'Design printable flashcards pairing abacus bead patterns with numerals. Pick your number range, style, and page layout.',
    },
  },
  {
    id: 'calendar',
    href: '/create/calendar',
    emoji: '📅',
    tier: 'secondary',
    order: 0,
    status: 'stable',
    preview: {
      src: '/images/create-previews/calendar.webp',
      width: 1232,
      height: 942,
      kind: 'paper',
      background: '#ffffff',
      alt: 'A generated wall calendar for August where every date is drawn as abacus beads.',
    },
    i18nKey: 'calendar',
    featureCount: 3,
    theme: {
      gradient: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
      shadowColor: 'rgba(251, 191, 36, 0.4)',
      checkBg: 'yellow.100',
      checkColor: 'yellow.600',
    },
    seo: {
      title: 'Abacus Calendar Generator',
      description:
        'Print a wall calendar where every date is drawn as abacus beads — a full month of number reading practice.',
    },
  },
  {
    id: 'music-flashcards',
    href: '/create/music-flashcards',
    emoji: '🎵',
    tier: 'secondary',
    order: 1,
    status: 'stable',
    preview: {
      src: '/images/create-previews/musicFlashcards.webp',
      width: 1148,
      height: 1023,
      kind: 'paper',
      background: '#ffffff',
      alt: 'Four generated music flashcards, each showing a single note climbing the treble staff from middle C to F.',
    },
    i18nKey: 'musicFlashcards',
    featureCount: 3,
    theme: {
      gradient: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      shadowColor: 'rgba(236, 72, 153, 0.4)',
      checkBg: 'pink.100',
      checkColor: 'pink.600',
    },
    seo: {
      title: 'Music Note Flashcard Creator',
      description:
        'Generate printable flashcards for reading music notation on treble and bass clef, including a violin first-position preset.',
    },
  },
] as const

/**
 * Route lookup for link sites elsewhere in the app (guides, empty states).
 *
 * Total over `CreateToolId` — unlike `getCreateTool`, so an `href={...}` needs
 * no `!` or fallback. The cast is safe because `CreateToolId` is closed and the
 * registry test asserts one entry per id.
 */
export const CREATE_TOOL_HREF = Object.fromEntries(
  CREATE_TOOLS.map((tool) => [tool.id, tool.href])
) as Record<CreateToolId, string>

/** Look up one tool. Returns `undefined` for an unknown id. */
export function getCreateTool(id: CreateToolId): CreateToolMeta | undefined {
  return CREATE_TOOLS.find((tool) => tool.id === id)
}

/** The tools in one tier, in `order`. */
export function getCreateToolsByTier(tier: CreateToolTier): CreateToolMeta[] {
  return CREATE_TOOLS.filter((tool) => tool.tier === tier).sort((a, b) => a.order - b.order)
}

/**
 * Every tool except `id` — the cross-link row on a tool's own page. Primary
 * tier first (the abacus trio is what most visitors want next), then `order`.
 */
export function getOtherCreateTools(id: CreateToolId): CreateToolMeta[] {
  const tierRank = (tier: CreateToolTier) => (tier === 'primary' ? 0 : 1)
  return CREATE_TOOLS.filter((tool) => tool.id !== id).sort(
    (a, b) => tierRank(a.tier) - tierRank(b.tier) || a.order - b.order
  )
}
