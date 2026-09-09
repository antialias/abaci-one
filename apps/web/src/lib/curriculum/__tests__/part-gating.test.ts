import { describe, expect, it } from 'vitest'
import { resolveEnabledPartTypes } from '../part-gating'

const ALL = { abacus: true, visualization: true, linear: true }

describe('resolveEnabledPartTypes', () => {
  it('keeps every requested part when the gates pass', () => {
    const r = resolveEnabledPartTypes({
      partsToInclude: ALL,
      hasVisualSkills: true,
      linearReadinessEnabled: true,
      linearReadyCount: 3,
      linearReadyBeforeVetoCount: 3,
    })
    expect(r.enabledPartTypes).toEqual(['abacus', 'visualization', 'linear'])
    expect(r.skippedParts).toEqual([])
  })

  it('reports linear as not-ready when nothing has graduated (flag on)', () => {
    const r = resolveEnabledPartTypes({
      partsToInclude: ALL,
      hasVisualSkills: true,
      linearReadinessEnabled: true,
      linearReadyCount: 0,
      linearReadyBeforeVetoCount: 0,
    })
    expect(r.enabledPartTypes).toEqual(['abacus', 'visualization'])
    expect(r.skippedParts).toEqual([{ type: 'linear', reason: 'not-ready' }])
  })

  it('reports linear as vetoed when skills graduated but every category is held off', () => {
    const r = resolveEnabledPartTypes({
      partsToInclude: ALL,
      hasVisualSkills: true,
      linearReadinessEnabled: true,
      linearReadyCount: 0,
      linearReadyBeforeVetoCount: 4,
    })
    expect(r.skippedParts).toEqual([{ type: 'linear', reason: 'vetoed' }])
  })

  it('flag off: linear rides the visual coupling and is skipped for lack of visual skills', () => {
    const r = resolveEnabledPartTypes({
      partsToInclude: ALL,
      hasVisualSkills: false,
      linearReadinessEnabled: false,
      linearReadyCount: 0,
      linearReadyBeforeVetoCount: 0,
    })
    expect(r.enabledPartTypes).toEqual(['abacus'])
    expect(r.skippedParts).toEqual([
      { type: 'visualization', reason: 'no-visual-skills' },
      { type: 'linear', reason: 'no-visual-skills' },
    ])
  })

  it('never reports a part the caller did not ask for', () => {
    const r = resolveEnabledPartTypes({
      partsToInclude: { abacus: true, visualization: false, linear: false },
      hasVisualSkills: false,
      linearReadinessEnabled: true,
      linearReadyCount: 0,
      linearReadyBeforeVetoCount: 0,
    })
    expect(r.enabledPartTypes).toEqual(['abacus'])
    expect(r.skippedParts).toEqual([])
  })
})
