import { describe, it, expect } from 'vitest'
import { generateUnifiedInstructionSequence } from '../unifiedStepGenerator'

describe('segment expression & rule detection', () => {
  it('direct 8 at ones: expression is "5 + 3", rule is Direct', () => {
    const seq = generateUnifiedInstructionSequence(0, 8) // +8
    const seg = seq.segments.find(s => s.place === 0)!
    expect(seg.expression.replace(/\s+/g, '')).toBe('5+3')
    expect(seg.plan.some(p => p.rule === 'Direct')).toBe(true)
    expect(seg.plan.some(p => p.rule === 'FiveComplement')).toBe(false)
    expect(seg.plan.some(p => p.rule === 'TenComplement')).toBe(false)
  })

  it('direct 6 at ones: expression is "5 + 1", rule is Direct', () => {
    const seq = generateUnifiedInstructionSequence(0, 6) // +6
    const seg = seq.segments.find(s => s.place === 0)!
    expect(seg.expression.replace(/\s+/g, '')).toBe('5+1')
    expect(seg.plan.some(p => p.rule === 'Direct')).toBe(true)
    expect(seg.plan.some(p => p.rule === 'FiveComplement')).toBe(false)
  })

  it('direct 9 at ones: expression is "5 + 4", rule is Direct', () => {
    const seq = generateUnifiedInstructionSequence(0, 9) // +9
    const seg = seq.segments.find(s => s.place === 0)!
    expect(seg.expression.replace(/\s+/g, '')).toBe('5+4')
    expect(seg.plan.some(p => p.rule === 'Direct')).toBe(true)
    expect(seg.plan.some(p => p.rule === 'FiveComplement')).toBe(false)
  })

  it('five-complement at ones (start 2, +3): expression is "(5 - 2)"', () => {
    const seq = generateUnifiedInstructionSequence(2, 5)
    const seg = seq.segments.find(s => s.place === 0)!
    expect(seg.expression.replace(/\s+/g, '')).toBe('(5-2)')
    expect(seg.plan.some(p => p.rule === 'FiveComplement')).toBe(true)
  })

  it('five-complement at ones (start 1, +4): expression is "(5 - 1)"', () => {
    const seq = generateUnifiedInstructionSequence(1, 5)
    const seg = seq.segments.find(s => s.place === 0)!
    expect(seg.expression.replace(/\s+/g, '')).toBe('(5-1)')
    expect(seg.plan.some(p => p.rule === 'FiveComplement')).toBe(true)
  })

  it('ten-complement no cascade (19 + 1 = 20): has TenComplement but not Cascade', () => {
    const seq = generateUnifiedInstructionSequence(19, 20)
    const seg = seq.segments.find(s => s.place === 0)!
    expect(seg.plan.some(p => p.rule === 'TenComplement')).toBe(true)
    expect(seg.plan.some(p => p.rule === 'Cascade')).toBe(false)
  })

  it('ten-complement with cascade (199 + 1 = 200): has Cascade', () => {
    const seq = generateUnifiedInstructionSequence(199, 200)
    const seg = seq.segments.find(s => s.place === 0)!
    expect(seg.plan.some(p => p.rule === 'Cascade')).toBe(true)
  })

  it('ranges: segment.termRange encloses all step.termPosition', () => {
    const seq = generateUnifiedInstructionSequence(3478, 3500) // +22
    const tensSeg = seq.segments.find(s => s.place === 1)!
    expect(tensSeg).toBeDefined()

    tensSeg.stepIndices.forEach(i => {
      const r = seq.steps[i].termPosition
      expect(r.startIndex >= tensSeg.termRange.startIndex).toBe(true)
      expect(r.endIndex <= tensSeg.termRange.endIndex).toBe(true)
    })
  })

  it('direct addition with multiple places maintains correct expressions', () => {
    const seq = generateUnifiedInstructionSequence(0, 68) // +68

    // Tens place: +6 should be "5 + 1" (direct)
    const tensSeg = seq.segments.find(s => s.place === 1)
    if (tensSeg) {
      expect(tensSeg.expression.replace(/\s+/g, '')).toBe('50+10')
      expect(tensSeg.plan.some(p => p.rule === 'Direct')).toBe(true)
    }

    // Ones place: +8 should be "5 + 3" (direct)
    const onesSeg = seq.segments.find(s => s.place === 0)
    if (onesSeg) {
      expect(onesSeg.expression.replace(/\s+/g, '')).toBe('5+3')
      expect(onesSeg.plan.some(p => p.rule === 'Direct')).toBe(true)
    }
  })

  it('ensures no false FiveComplement classification for direct 6-9 adds', () => {
    // Test all direct 6-9 additions to ensure they're never classified as FiveComplement
    for (let digit = 6; digit <= 9; digit++) {
      const seq = generateUnifiedInstructionSequence(0, digit)
      const seg = seq.segments.find(s => s.place === 0)!

      expect(seg.plan.some(p => p.rule === 'Direct')).toBe(true)
      expect(seg.plan.some(p => p.rule === 'FiveComplement')).toBe(false)
      expect(seg.expression).toMatch(/^5 \+ \d+$/)
    }
  })

  it('validates complement expressions use parentheses', () => {
    // Five complement
    const fiveCompSeq = generateUnifiedInstructionSequence(2, 5)
    const fiveCompSeg = fiveCompSeq.segments.find(s => s.place === 0)!
    expect(fiveCompSeg.expression).toMatch(/^\(.+\)$/) // Should be wrapped in parentheses

    // Ten complement
    const tenCompSeq = generateUnifiedInstructionSequence(19, 20)
    const tenCompSeg = tenCompSeq.segments.find(s => s.place === 0)!
    expect(tenCompSeg.expression).toMatch(/^\(.+\)$/) // Should be wrapped in parentheses
  })
})