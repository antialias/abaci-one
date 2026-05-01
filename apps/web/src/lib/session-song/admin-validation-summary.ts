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

export interface AdminSongSectionSummary {
  name: string
  durationMs: number
  lineCount: number
}

export interface AdminSongPlanSummary {
  title: string | null
  styles: string[]
  totalDurationMs: number
  sectionSummary: AdminSongSectionSummary[]
}

export function getAdminSongPlanSummary(llmOutput: unknown): AdminSongPlanSummary {
  const output = asRecord(llmOutput)
  const plan = asRecord(output?.plan)
  const rawSections = Array.isArray(plan?.sections) ? plan.sections : []
  const sections = rawSections.filter(
    (section): section is Record<string, unknown> => asRecord(section) !== null
  )

  const sectionSummary = sections.map((section) => {
    const lines = section.lines
    const durationMs = typeof section.duration_ms === 'number' ? section.duration_ms : 0

    return {
      name: typeof section.section_name === 'string' ? section.section_name : 'Untitled section',
      durationMs,
      lineCount: Array.isArray(lines) ? lines.length : 0,
    }
  })

  return {
    title: typeof output?.title === 'string' ? output.title : null,
    styles: Array.isArray(plan?.positive_global_styles)
      ? plan.positive_global_styles.filter((style): style is string => typeof style === 'string')
      : [],
    totalDurationMs: sectionSummary.reduce((sum, section) => sum + section.durationMs, 0),
    sectionSummary,
  }
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
