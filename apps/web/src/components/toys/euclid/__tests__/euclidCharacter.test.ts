import { describe, it, expect } from 'vitest'
import {
  buildCompletionContext,
  EUCLID_CHARACTER,
  EUCLID_TEACHING_STYLE,
  EUCLID_WHAT_NOT_TO_DO,
  EUCLID_POINT_LABELING,
  EUCLID_DIAGRAM_QUESTION,
} from '../euclidCharacter'

describe('euclidCharacter constants', () => {
  it('exports CHARACTER block', () => {
    expect(EUCLID_CHARACTER).toContain('=== CHARACTER ===')
    expect(EUCLID_CHARACTER).toContain('Alexandria')
  })

  it('exports TEACHING_STYLE block', () => {
    expect(EUCLID_TEACHING_STYLE).toContain('=== TEACHING STYLE ===')
    expect(EUCLID_TEACHING_STYLE).toContain('Q.E.F.')
  })

  it('exports WHAT_NOT_TO_DO block', () => {
    expect(EUCLID_WHAT_NOT_TO_DO).toContain('=== WHAT NOT TO DO ===')
  })

  it('exports POINT_LABELING block', () => {
    expect(EUCLID_POINT_LABELING).toContain('=== POINT LABELING')
    expect(EUCLID_POINT_LABELING).toContain('sequential order')
  })

  it('exports DIAGRAM_QUESTION block', () => {
    expect(EUCLID_DIAGRAM_QUESTION).toContain('=== THE DIAGRAM QUESTION')
    expect(EUCLID_DIAGRAM_QUESTION).toContain('Hilbert')
  })
})

describe('buildCompletionContext', () => {
  it('mentions Q.E.F. and Q.E.D.', () => {
    const ctx = buildCompletionContext(1)
    expect(ctx).toContain('Q.E.F.')
    expect(ctx).toContain('Q.E.D.')
  })

  it('includes the next proposition info for a valid proposition', () => {
    const ctx = buildCompletionContext(1)
    // Prop I.2 exists and should be referenced
    expect(ctx).toContain('I.2')
  })

  it('handles last proposition gracefully', () => {
    // Prop 48 is the last in Book I
    const ctx = buildCompletionContext(48)
    expect(ctx).toContain('COMPLETE')
  })

  it('mentions dragging points', () => {
    const ctx = buildCompletionContext(1)
    expect(ctx).toContain('drag')
  })
})
