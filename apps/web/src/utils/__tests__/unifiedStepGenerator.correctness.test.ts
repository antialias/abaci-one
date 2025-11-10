import { describe, expect, it } from 'vitest'
import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

describe('expressions & rule classification', () => {
  it('direct 8 at ones: expression "5 + 3", rule Direct', () => {
    const seq = generateUnifiedInstructionSequence(0, 8)
    const seg = seq.segments.find((s) => s.place === 0)!
    expect(seg.expression.replace(/\s+/g, '')).toBe('5+3')
    expect(seg.plan.some((p) => p.rule === 'Direct')).toBe(true)
    expect(seg.plan.some((p) => p.rule === 'FiveComplement')).toBe(false)
    expect(seg.plan.some((p) => p.rule === 'TenComplement')).toBe(false)
  })

  it('five complement (2 + 3): expression "(5 - 2)" and FiveComplement', () => {
    const seq = generateUnifiedInstructionSequence(2, 5)
    const seg = seq.segments.find((s) => s.place === 0)!
    expect(seg.expression.replace(/\s+/g, '')).toBe('(5-2)')
    expect(seg.plan.some((p) => p.rule === 'FiveComplement')).toBe(true)
  })

  it('ten complement no cascade (19 + 1): TenComplement only', () => {
    const seq = generateUnifiedInstructionSequence(19, 20)
    const onesSeg = seq.segments.find((s) => s.place === 0)!
    expect(onesSeg.plan.some((p) => p.rule === 'TenComplement')).toBe(true)
    expect(onesSeg.plan.some((p) => p.rule === 'Cascade')).toBe(false)
    // Expression should be "(10 - 9)"
    expect(onesSeg.expression.replace(/\s+/g, '')).toBe('(10-9)')
  })

  it('ten complement with cascade (99 + 1): TenComplement + Cascade', () => {
    const seq = generateUnifiedInstructionSequence(99, 100)
    const onesSeg = seq.segments.find((s) => s.place === 0)!
    expect(onesSeg.plan.some((p) => p.rule === 'TenComplement')).toBe(true)
    expect(onesSeg.plan.some((p) => p.rule === 'Cascade')).toBe(true)
    // Expression should be "(100 - 90 - 9)"
    expect(onesSeg.expression.replace(/\s+/g, '')).toBe('(100-90-9)')
  })

  it('term ranges include all step term positions', () => {
    const seq = generateUnifiedInstructionSequence(3478, 3500) // +22
    const tensSeg = seq.segments.find((s) => s.place === 1)!
    tensSeg.stepIndices.forEach((i) => {
      const r = seq.steps[i].termPosition
      expect(r.startIndex >= tensSeg.termRange.startIndex).toBe(true)
      expect(r.endIndex <= tensSeg.termRange.endIndex).toBe(true)
    })
  })

  // Guard tests to prevent specific regressions
  it('prevents false FiveComplement on direct 6-9 adds', () => {
    for (let digit = 6; digit <= 9; digit++) {
      const seq = generateUnifiedInstructionSequence(0, digit)
      const seg = seq.segments.find((s) => s.place === 0)!
      expect(seg.plan.some((p) => p.rule === 'Direct')).toBe(true)
      expect(seg.plan.some((p) => p.rule === 'FiveComplement')).toBe(false)
      expect(seg.expression).toMatch(/^5 \+ \d+$/)
    }
  })

  it('validates expressions use correct format (parentheses for complements only)', () => {
    // Direct additions: no parentheses
    const directSeq = generateUnifiedInstructionSequence(0, 8)
    const directSeg = directSeq.segments.find((s) => s.place === 0)!
    expect(directSeg.expression).not.toMatch(/^\(.+\)$/)

    // Five complement: parentheses
    const fiveCompSeq = generateUnifiedInstructionSequence(2, 5)
    const fiveCompSeg = fiveCompSeq.segments.find((s) => s.place === 0)!
    expect(fiveCompSeg.expression).toMatch(/^\(.+\)$/)

    // Ten complement: parentheses
    const tenCompSeq = generateUnifiedInstructionSequence(19, 20)
    const tenCompSeg = tenCompSeq.segments.find((s) => s.place === 0)!
    expect(tenCompSeg.expression).toMatch(/^\(.+\)$/)
  })

  it('handles more complex cascade scenarios', () => {
    // 999 + 1 = 1000 (cascade through all places)
    const seq = generateUnifiedInstructionSequence(999, 1000)
    const onesSeg = seq.segments.find((s) => s.place === 0)!
    expect(onesSeg.plan.some((p) => p.rule === 'Cascade')).toBe(true)
    expect(onesSeg.expression).toMatch(/^\(1000 - 900 - 90 - 9\)$/)
  })
})
