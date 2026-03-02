import type { EntityMarkerConfig } from '@/lib/character/types'
import type { EuclidEntityRef } from './chat/parseGeometricEntities'

/** Display text for each entity tag */
function displayText(tag: string, value: string): string {
  switch (tag) {
    case 'seg': return value       // "AB"
    case 'tri': return `\u25B3${value}` // "△ABC"
    case 'ang': return `\u2220${value}` // "∠ABC"
    case 'pt': return value        // "A"
    case 'def': return `Definition ${value}`
    case 'post': return `Postulate ${value}`
    case 'cn': return `Common Notion ${value}`
    case 'prop': return `Proposition I.${value}`
    default: return value
  }
}

/** Build an EuclidEntityRef from tag + value, or null if invalid. */
function buildEntity(tag: string, value: string): EuclidEntityRef | null {
  switch (tag) {
    case 'seg':
      if (value.length === 2) return { type: 'segment', from: value[0], to: value[1] }
      return null
    case 'tri':
      if (value.length === 3) return { type: 'triangle', vertices: [value[0], value[1], value[2]] }
      return null
    case 'ang':
      if (value.length === 3) return { type: 'angle', points: [value[0], value[1], value[2]] }
      return null
    case 'pt':
      if (value.length === 1) return { type: 'point', label: value[0] }
      return null
    case 'def': {
      const n = parseInt(value, 10)
      return !isNaN(n) && n >= 1 ? { type: 'definition', id: n } : null
    }
    case 'post': {
      const n = parseInt(value, 10)
      return !isNaN(n) && n >= 1 ? { type: 'postulate', id: n } : null
    }
    case 'cn': {
      const n = parseInt(value, 10)
      return !isNaN(n) && n >= 1 ? { type: 'commonNotion', id: n } : null
    }
    case 'prop': {
      const n = parseInt(value, 10)
      return !isNaN(n) && n >= 1 ? { type: 'proposition', id: n } : null
    }
    default:
      return null
  }
}

/**
 * Unified entity marker config for Euclid chat.
 *
 * Matches geometric markers ({seg:AB}, {tri:ABC}, {ang:ABC}, {pt:A})
 * and foundation/proposition markers ({def:15}, {post:1}, {cn:1}, {prop:5}).
 *
 * Supports optional display text override: {prop:1|my first proposition}
 * renders as "my first proposition" instead of the canonical "Proposition I.1".
 *
 * The regex uses alternation: geometric tags require uppercase letters,
 * foundation tags require digits. Each branch has an optional |override group.
 */
export const EUCLID_ENTITY_MARKERS: EntityMarkerConfig<EuclidEntityRef> = {
  pattern: /\{(seg|tri|ang|pt):([A-Z]+)(?:\|([^}]*))?\}|\{(def|post|cn|prop):(\d+)(?:\|([^}]*))?\}/g,
  parseMatch: (groups) => {
    // Alternation: either groups[0]+[1]+[2?] matched (geometric) or groups[3]+[4]+[5?] (foundation)
    const tag = groups[0] ?? groups[3]
    const value = groups[1] ?? groups[4]
    const override = groups[2] ?? groups[5]
    if (!tag || !value) return null
    const entity = buildEntity(tag, value)
    if (!entity) return null
    return { entity, displayText: override || displayText(tag, value) }
  },
}
