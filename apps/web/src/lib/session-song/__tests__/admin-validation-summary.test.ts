import { describe, expect, it } from 'vitest'
import { getAdminSongPlanSummary, getSongPlanValidationSummary } from '../admin-validation-summary'

describe('getSongPlanValidationSummary', () => {
  it('extracts validation summary fields for admin song rows', () => {
    const summary = getSongPlanValidationSummary({
      title: 'Test Song',
      validation: {
        mode: 'observe',
        outcome: 'flagged',
        issues: [
          {
            code: 'missing_game_detail',
            message: 'No game detail used.',
            evidenceType: 'game',
          },
        ],
        repairAttempts: 1,
        fallbackUsed: false,
      },
    })

    expect(summary).toEqual({
      validationMode: 'observe',
      validationOutcome: 'flagged',
      validationIssueCount: 1,
      validationIssues: [
        {
          code: 'missing_game_detail',
          message: 'No game detail used.',
          evidenceType: 'game',
        },
      ],
      repairAttempts: 1,
      fallbackUsed: false,
    })
  })

  it('returns empty summary for legacy rows without validation metadata', () => {
    expect(getSongPlanValidationSummary({ title: 'Legacy Song' })).toEqual({
      validationMode: null,
      validationOutcome: null,
      validationIssueCount: 0,
      validationIssues: [],
      repairAttempts: null,
      fallbackUsed: false,
    })
  })
})

describe('getAdminSongPlanSummary', () => {
  it('extracts title, styles, sections, and total duration for admin song rows', () => {
    expect(
      getAdminSongPlanSummary({
        title: 'Test Song',
        plan: {
          positive_global_styles: ['children', 'funk', 42, null],
          sections: [
            {
              section_name: 'Verse',
              duration_ms: 12000,
              lines: ['one', 'two'],
            },
            {
              section_name: 'Chorus',
              duration_ms: 8000,
              lines: ['three'],
            },
          ],
        },
      })
    ).toEqual({
      title: 'Test Song',
      styles: ['children', 'funk'],
      totalDurationMs: 20000,
      sectionSummary: [
        { name: 'Verse', durationMs: 12000, lineCount: 2 },
        { name: 'Chorus', durationMs: 8000, lineCount: 1 },
      ],
    })
  })

  it('returns a safe empty summary for malformed legacy output', () => {
    expect(
      getAdminSongPlanSummary({
        title: 123,
        plan: {
          positive_global_styles: 'funk',
          sections: {
            section_name: 'Not actually an array',
          },
        },
      })
    ).toEqual({
      title: null,
      styles: [],
      totalDurationMs: 0,
      sectionSummary: [],
    })
  })
})
