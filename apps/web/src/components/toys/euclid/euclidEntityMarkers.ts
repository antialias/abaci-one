import type { EntityMarkerConfig } from '@/lib/character/types'
import type { GeometricEntityRef } from './chat/parseGeometricEntities'

/** Display text for each geometric entity tag */
function displayText(tag: string, labels: string): string {
  switch (tag) {
    case 'seg': return labels       // "AB"
    case 'tri': return `\u25B3${labels}` // "△ABC"
    case 'ang': return `\u2220${labels}` // "∠ABC"
    case 'pt': return labels        // "A"
    default: return labels
  }
}

/** Build a GeometricEntityRef from tag + labels, or null if invalid. */
function buildEntity(tag: string, labels: string): GeometricEntityRef | null {
  switch (tag) {
    case 'seg':
      if (labels.length === 2) return { type: 'segment', from: labels[0], to: labels[1] }
      return null
    case 'tri':
      if (labels.length === 3) return { type: 'triangle', vertices: [labels[0], labels[1], labels[2]] }
      return null
    case 'ang':
      if (labels.length === 3) return { type: 'angle', points: [labels[0], labels[1], labels[2]] }
      return null
    case 'pt':
      if (labels.length === 1) return { type: 'point', label: labels[0] }
      return null
    default:
      return null
  }
}

export const EUCLID_ENTITY_MARKERS: EntityMarkerConfig<GeometricEntityRef> = {
  pattern: /\{(seg|tri|ang|pt):([A-Z]+)\}/g,
  parseMatch: (groups) => {
    const [tag, labels] = groups
    if (!tag || !labels) return null
    const entity = buildEntity(tag, labels)
    if (!entity) return null
    return { entity, displayText: displayText(tag, labels) }
  },
}
