/**
 * The registered presentations (practice-kinds plan §1.1, §3.1, K1b).
 */

import { describe, expect, it } from 'vitest'
import type { SessionPart } from '@/db/schema/session-plans'
import { arithmeticPresentations } from '../arithmetic/presentations'
import { findPresentation, masteryModeOf, registeredPresentations } from '../presentations'

const part = (type: SessionPart['type'], useAbacus: boolean) =>
  ({ partNumber: 1, type, useAbacus }) as SessionPart

describe('arithmetic presentations', () => {
  it('registers abacus, visualization, linear, each its own mastery mode', () => {
    expect(registeredPresentations().map((p) => [p.id, p.masteryMode])).toEqual([
      ['abacus', 'abacus'],
      ['visualization', 'visualization'],
      ['linear', 'linear'],
    ])
  })

  it('needsPhysicalAbacus follows §1.1: abacus yes, visualization no, linear = part.useAbacus', () => {
    const needs = (id: string, p: SessionPart) =>
      arithmeticPresentations.get(id)?.needsPhysicalAbacus(p)
    expect(needs('abacus', part('abacus', true))).toBe(true)
    expect(needs('visualization', part('visualization', false))).toBe(false)
    expect(needs('linear', part('linear', true))).toBe(true)
    expect(needs('linear', part('linear', false))).toBe(false)
  })

  it("an id no registry knows is its own mode; a registered one, the presentation's", () => {
    expect(findPresentation('read_abacus.flash')).toBeUndefined()
    expect(masteryModeOf('read_abacus.flash')).toBe('read_abacus.flash')
    expect(masteryModeOf('linear')).toBe('linear')
  })
})
