export interface AdminSongValidationIssue {
  code: string
  message: string
  evidenceType: string | null
}

export interface AdminSongValidationSummary {
  validationMode: string | null
  validationOutcome: string | null
  validationIssueCount: number
  validationIssues: AdminSongValidationIssue[]
  repairAttempts: number | null
  fallbackUsed: boolean
}

export function getSongPlanValidationSummary(llmOutput: unknown): AdminSongValidationSummary {
  const output = asRecord(llmOutput)
  const validation = asRecord(output?.validation)
  const issues = Array.isArray(validation?.issues)
    ? validation.issues.filter(
        (issue): issue is Record<string, unknown> => asRecord(issue) !== null
      )
    : []

  return {
    validationMode: typeof validation?.mode === 'string' ? validation.mode : null,
    validationOutcome: typeof validation?.outcome === 'string' ? validation.outcome : null,
    validationIssueCount: issues.length,
    validationIssues: issues.map((issue) => ({
      code: typeof issue.code === 'string' ? issue.code : 'unknown',
      message: typeof issue.message === 'string' ? issue.message : '',
      evidenceType: typeof issue.evidenceType === 'string' ? issue.evidenceType : null,
    })),
    repairAttempts:
      typeof validation?.repairAttempts === 'number' ? validation.repairAttempts : null,
    fallbackUsed: typeof validation?.fallbackUsed === 'boolean' ? validation.fallbackUsed : false,
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
