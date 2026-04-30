import { describe, expect, it } from 'vitest'
import { getSongPlanValidationSummary } from '../admin-validation-summary'

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
