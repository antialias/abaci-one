/**
 * The attempt panel reads a try's retry round through the normalizer (Phase
 * 6a): the same labels, order and `data-epoch` with or without the legacy
 * fields, and a practice-only do-over carries a "practice" tag.
 */

import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SlotResult } from '@/db/schema/session-plans'
import { AttemptHistoryPanel, type ResultWithGlobalIndex } from '../AttemptHistoryPanel'

vi.mock('../../../../styled-system/css', () => ({
  css: vi.fn(() => 'mocked-css-class'),
}))

function row(over: Partial<SlotResult>): SlotResult {
  return {
    slotId: 'p1s0',
    partNumber: 1,
    slotIndex: 0,
    problem: { terms: [3, 4], answer: 7, skillsRequired: [] } as never,
    studentAnswer: 7,
    isCorrect: true,
    responseTimeMs: 3000,
    skillsExercised: ['basic.directAddition'],
    usedOnScreenAbacus: false,
    timestamp: new Date('2026-11-01T10:00:00Z'),
    hadHelp: false,
    incorrectAttempts: 0,
    ...over,
  }
}

/** One item's tries as the writers record them, in recorded order */
function writtenTries(): ResultWithGlobalIndex[] {
  return [
    row({
      kind: 'first',
      round: 0,
      practiceOnly: false,
      isCorrect: false,
      studentAnswer: 1,
      masteryWeight: 1,
      isRetry: false,
      epochNumber: 0,
      originalSlotIndex: 0,
    }),
    row({
      kind: 'do_over',
      round: 1,
      practiceOnly: false,
      isCorrect: false,
      studentAnswer: 2,
      masteryWeight: 0.5,
      isManualRedo: true,
      isRetry: false,
      epochNumber: 0,
      originalSlotIndex: 0,
    }),
    row({
      kind: 'retry',
      round: 1,
      practiceOnly: false,
      masteryWeight: 0.5,
      isRetry: true,
      epochNumber: 1,
      originalSlotIndex: 0,
    }),
    row({
      kind: 'do_over',
      round: 3,
      practiceOnly: true,
      masteryWeight: 0,
      isManualRedo: true,
      isRetry: false,
      epochNumber: 0,
      originalSlotIndex: 0,
    }),
  ].map((result, globalIndex) => ({ result, globalIndex }))
}

function stripLegacy({ result, globalIndex }: ResultWithGlobalIndex): ResultWithGlobalIndex {
  const { isRetry: _r, epochNumber: _e, isManualRedo: _m, originalSlotIndex: _o, ...rest } = result
  return { result: rest as SlotResult, globalIndex }
}

function renderedRows(results: ResultWithGlobalIndex[]) {
  const { container, unmount } = render(
    <AttemptHistoryPanel
      results={results}
      correctAnswer={7}
      isDark={false}
      studentId="student-1"
      planId="plan-1"
    />
  )
  const rows = [...container.querySelectorAll('[data-element="attempt-row"]')].map((el) => ({
    epoch: el.getAttribute('data-epoch'),
    practiceOnly: el.getAttribute('data-practice-only'),
    text: el.textContent,
  }))
  unmount()
  return rows
}

describe('AttemptHistoryPanel (Phase 6a)', () => {
  it('lists the tries the same without their legacy fields (labels, order, data-epoch)', () => {
    const withFields = renderedRows(writtenTries())
    expect(renderedRows(writtenTries().map(stripLegacy))).toEqual(withFields)
    // The retry sorts last; a do-over is listed as 'Original', as before
    expect(withFields.map((r) => r.epoch)).toEqual(['0', '0', '0', '1'])
    expect(withFields[3].text).toContain('Retry 1')
    expect(withFields[1].text).toContain('Original')
  })

  it('keeps a legacy row from before the retry system as an original', () => {
    const legacy = [{ result: row({}), globalIndex: 0 }]
    const [only] = renderedRows(legacy)
    expect(only.epoch).toBe('0')
    expect(only.text).toContain('Original')
  })

  it('tags a practice-only do-over "practice", and nothing else', () => {
    const rows = renderedRows(writtenTries())
    expect(rows.map((r) => r.practiceOnly)).toEqual([null, null, 'true', null])
    expect(rows.filter((r) => r.text?.includes('practice')).length).toBe(1)
    expect(rows[2].text).toContain('practice')
  })
})
