/**
 * Server-safe metadata for spot components.
 * Separated from the client-only registry so API routes can read the list.
 */

export interface SpotComponentMeta {
  id: string
  label: string
  description: string
}

export const SPOT_COMPONENT_LIST: SpotComponentMeta[] = [
  {
    id: 'practice-showcase',
    label: 'Practice Showcase',
    description: 'Row of practice problems in various states (correct, active, waiting)',
  },
  {
    id: 'start-practice-modal',
    label: 'Start Practice Modal',
    description: 'Static showcase of the session configuration modal',
  },
  {
    id: 'practice-showcase-compact',
    label: 'Practice Showcase (Compact)',
    description: 'Compact row of 3 practice problems for tighter layouts',
  },
  {
    id: 'ten-frames-demo',
    label: 'Ten-Frames Demo',
    description: 'Interactive ten-frames addition demonstration',
  },
  {
    id: 'multi-digit-demo',
    label: 'Multi-Digit Demo',
    description: 'Multi-digit addition with place value scaffolding',
  },
  {
    id: 'start-practice-modal-expanded',
    label: 'Start Practice Modal (Expanded)',
    description: 'Expanded view of the session configuration modal with all settings visible',
  },
]

/** Get list of available spot components for admin UI dropdowns */
export function getSpotComponentList(): SpotComponentMeta[] {
  return SPOT_COMPONENT_LIST
}
