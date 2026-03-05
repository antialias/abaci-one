/**
 * Spot definition registry — declares which spots exist on which pages.
 *
 * Definitions are static metadata; config (prompt, component choice, etc.)
 * lives in content/page-spots/{pageId}.json and is managed via the admin UI.
 */

export interface SpotDefinition {
  /** Unique spot ID within its page (kebab-case) */
  id: string
  /** Human-readable label for admin UI */
  label: string
  /** Description of where/how the spot is used */
  description: string
  /** Suggested aspect ratio for rendering (CSS string, e.g. "16 / 9") */
  aspectRatio?: string
}

export interface PageSpotGroup {
  /** Unique page ID (kebab-case, e.g. "home") */
  pageId: string
  /** Human-readable page name */
  label: string
  /** Spots declared for this page */
  spots: SpotDefinition[]
}

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const PAGE_SPOT_GROUPS: PageSpotGroup[] = [
  {
    pageId: 'home',
    label: 'Home Page',
    spots: [
      {
        id: 'hero',
        label: 'Hero',
        description: 'Main hero area at the top of the home page',
        aspectRatio: '2.4 / 1',
      },
      {
        id: 'feature-1',
        label: 'Feature 1',
        description: 'First feature showcase section',
        aspectRatio: '16 / 9',
      },
      {
        id: 'feature-2',
        label: 'Feature 2',
        description: 'Second feature showcase section',
        aspectRatio: '16 / 9',
      },
      {
        id: 'feature-3',
        label: 'Feature 3',
        description: 'Third feature showcase section',
        aspectRatio: '16 / 9',
      },
      {
        id: 'cta',
        label: 'Call to Action',
        description: 'Visual content for the call-to-action section',
        aspectRatio: '3 / 1',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function getAllPageSpotGroups(): PageSpotGroup[] {
  return PAGE_SPOT_GROUPS
}

export function getPageSpotGroup(pageId: string): PageSpotGroup | undefined {
  return PAGE_SPOT_GROUPS.find((g) => g.pageId === pageId)
}

export function getSpotDefinition(pageId: string, spotId: string): SpotDefinition | undefined {
  return getPageSpotGroup(pageId)?.spots.find((s) => s.id === spotId)
}
