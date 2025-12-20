/**
 * Practice Help Hook
 *
 * Manages progressive help during practice sessions.
 * Integrates with the tutorial system to provide escalating levels of assistance.
 *
 * Help Levels:
 * - L0: No help - student is working independently
 * - L1: Coach hint - verbal encouragement ("Think about what makes 10")
 * - L2: Decomposition - show the mathematical breakdown
 * - L3: Bead arrows - highlight specific bead movements
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { HelpLevel } from '@/db/schema/session-plans'
import type { StudentHelpSettings } from '@/db/schema/players'
import {
  generateUnifiedInstructionSequence,
  type PedagogicalSegment,
  type UnifiedInstructionSequence,
  type UnifiedStepData,
} from '@/utils/unifiedStepGenerator'
import { extractSkillsFromSequence, type ExtractedSkill } from '@/utils/skillExtraction'

/**
 * Current term context for help
 */
export interface TermContext {
  /** Current abacus value before this term */
  currentValue: number
  /** Target value after adding this term */
  targetValue: number
  /** The term being added (difference) */
  term: number
  /** Index of this term in the problem */
  termIndex: number
}

/**
 * Help content at different levels
 */
export interface HelpContent {
  /** Level 1: Coach hint - short verbal guidance */
  coachHint: string
  /** Level 2: Decomposition string and explanation */
  decomposition: {
    /** Full decomposition string (e.g., "3 + 7 = 3 + (10 - 3) = 10") */
    fullDecomposition: string
    /** Whether this decomposition is pedagogically meaningful */
    isMeaningful: boolean
    /** Segments with readable explanations */
    segments: PedagogicalSegment[]
  }
  /** Level 3: Step-by-step bead movements */
  beadSteps: UnifiedStepData[]
  /** Skills exercised in this term */
  skills: ExtractedSkill[]
  /** The underlying instruction sequence */
  sequence: UnifiedInstructionSequence | null
}

/**
 * Help state returned by the hook
 */
export interface PracticeHelpState {
  /** Current help level (0-3) */
  currentLevel: HelpLevel
  /** Help content for the current term */
  content: HelpContent | null
  /** Maximum help level used so far for this term */
  maxLevelUsed: HelpLevel
  /** Whether help is available (sequence generated successfully) */
  isAvailable: boolean
  /** Time since help became available (for auto-escalation) */
  elapsedTimeMs: number
  /** How help was triggered */
  trigger: 'none' | 'manual' | 'auto-time' | 'auto-errors'
}

/**
 * Actions for managing help
 */
export interface PracticeHelpActions {
  /** Request help at a specific level (or next level if not specified) */
  requestHelp: (level?: HelpLevel) => void
  /** Escalate to the next help level */
  escalateHelp: () => void
  /** Reset help state for a new term */
  resetForNewTerm: (context: TermContext) => void
  /** Dismiss current help (return to L0) */
  dismissHelp: () => void
  /** Mark that an error occurred (for auto-escalation) */
  recordError: () => void
}

/**
 * Configuration for help behavior
 */
export interface PracticeHelpConfig {
  /** Student's help settings */
  settings: StudentHelpSettings
  /** Whether this student is a beginner (free help without penalty) */
  isBeginnerMode: boolean
  /** BKT-based skill classification of the student (affects auto-escalation) */
  studentBktClassification?: 'strong' | 'developing' | 'weak' | null
  /** Callback when help level changes (for tracking) */
  onHelpLevelChange?: (level: HelpLevel, trigger: PracticeHelpState['trigger']) => void
  /** Callback when max help level updates */
  onMaxLevelUpdate?: (maxLevel: HelpLevel) => void
}

const DEFAULT_SETTINGS: StudentHelpSettings = {
  helpMode: 'auto',
  autoEscalationTimingMs: {
    level1: 30000,
    level2: 60000,
    level3: 90000,
  },
  beginnerFreeHelp: true,
  advancedRequiresApproval: false,
}

/**
 * Generate coach hint based on the pedagogical segment
 */
function generateCoachHint(segment: PedagogicalSegment | undefined): string {
  if (!segment) {
    return 'Take your time and think through each step.'
  }

  const rule = segment.plan[0]?.rule
  const readable = segment.readable

  switch (rule) {
    case 'Direct':
      return (
        readable.summary ||
        `You can add ${segment.digit} directly to the ${readable.title.split(' — ')[1] || 'column'}.`
      )
    case 'FiveComplement':
      return `Think about friends of 5. What plus ${5 - segment.digit} makes 5?`
    case 'TenComplement':
      return `Think about friends of 10. What plus ${10 - segment.digit} makes 10?`
    case 'Cascade':
      return 'This will carry through multiple columns. Start from the left.'
    default:
      return 'Think about which beads need to move.'
  }
}

/**
 * Hook for managing progressive help during practice
 */
export function usePracticeHelp(
  config: PracticeHelpConfig
): [PracticeHelpState, PracticeHelpActions] {
  const {
    settings = DEFAULT_SETTINGS,
    isBeginnerMode,
    onHelpLevelChange,
    onMaxLevelUpdate,
  } = config

  // Current term context
  const [termContext, setTermContext] = useState<TermContext | null>(null)

  // Help state
  const [currentLevel, setCurrentLevel] = useState<HelpLevel>(0)
  const [maxLevelUsed, setMaxLevelUsed] = useState<HelpLevel>(0)
  const [trigger, setTrigger] = useState<PracticeHelpState['trigger']>('none')
  const [errorCount, setErrorCount] = useState(0)

  // Timer for auto-escalation
  const [startTime, setStartTime] = useState<number | null>(null)
  const [elapsedTimeMs, setElapsedTimeMs] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Generate instruction sequence for current term
  const sequence = useMemo<UnifiedInstructionSequence | null>(() => {
    if (!termContext) return null
    try {
      return generateUnifiedInstructionSequence(termContext.currentValue, termContext.targetValue)
    } catch {
      // Subtraction or other unsupported operations
      return null
    }
  }, [termContext])

  // Extract skills from sequence
  const skills = useMemo<ExtractedSkill[]>(() => {
    if (!sequence) return []
    return extractSkillsFromSequence(sequence)
  }, [sequence])

  // Build help content
  const content = useMemo<HelpContent | null>(() => {
    if (!sequence) return null

    const firstSegment = sequence.segments[0]

    return {
      coachHint: generateCoachHint(firstSegment),
      decomposition: {
        fullDecomposition: sequence.fullDecomposition,
        isMeaningful: sequence.isMeaningfulDecomposition,
        segments: sequence.segments,
      },
      beadSteps: sequence.steps,
      skills,
      sequence,
    }
  }, [sequence, skills])

  // Check if help is available
  const isAvailable = sequence !== null

  // Start/stop timer for elapsed time tracking
  useEffect(() => {
    if (termContext && startTime === null) {
      setStartTime(Date.now())
    }

    // Update elapsed time every second
    if (startTime !== null) {
      timerRef.current = setInterval(() => {
        setElapsedTimeMs(Date.now() - startTime)
      }, 1000)
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [termContext, startTime])

  // Auto-escalation based on time (only in 'auto' mode)
  useEffect(() => {
    if (settings.helpMode !== 'auto' || !isAvailable) return

    const { autoEscalationTimingMs } = settings

    // Check if we should auto-escalate
    if (currentLevel === 0 && elapsedTimeMs >= autoEscalationTimingMs.level1) {
      setCurrentLevel(1)
      setTrigger('auto-time')
      if (1 > maxLevelUsed) {
        setMaxLevelUsed(1)
        onMaxLevelUpdate?.(1)
      }
      onHelpLevelChange?.(1, 'auto-time')
    } else if (currentLevel === 1 && elapsedTimeMs >= autoEscalationTimingMs.level2) {
      setCurrentLevel(2)
      setTrigger('auto-time')
      if (2 > maxLevelUsed) {
        setMaxLevelUsed(2)
        onMaxLevelUpdate?.(2)
      }
      onHelpLevelChange?.(2, 'auto-time')
    } else if (currentLevel === 2 && elapsedTimeMs >= autoEscalationTimingMs.level3) {
      setCurrentLevel(3)
      setTrigger('auto-time')
      if (3 > maxLevelUsed) {
        setMaxLevelUsed(3)
        onMaxLevelUpdate?.(3)
      }
      onHelpLevelChange?.(3, 'auto-time')
    }
  }, [
    elapsedTimeMs,
    currentLevel,
    settings.helpMode,
    settings.autoEscalationTimingMs,
    isAvailable,
    maxLevelUsed,
    onHelpLevelChange,
    onMaxLevelUpdate,
  ])

  // Auto-escalation based on errors
  useEffect(() => {
    if (settings.helpMode !== 'auto' || !isAvailable) return

    // After 2 errors, escalate to L1
    // After 3 errors, escalate to L2
    // After 4 errors, escalate to L3
    let targetLevel: HelpLevel = 0
    if (errorCount >= 4) {
      targetLevel = 3
    } else if (errorCount >= 3) {
      targetLevel = 2
    } else if (errorCount >= 2) {
      targetLevel = 1
    }

    if (targetLevel > currentLevel) {
      setCurrentLevel(targetLevel)
      setTrigger('auto-errors')
      if (targetLevel > maxLevelUsed) {
        setMaxLevelUsed(targetLevel)
        onMaxLevelUpdate?.(targetLevel)
      }
      onHelpLevelChange?.(targetLevel, 'auto-errors')
    }
  }, [
    errorCount,
    currentLevel,
    settings.helpMode,
    isAvailable,
    maxLevelUsed,
    onHelpLevelChange,
    onMaxLevelUpdate,
  ])

  // Actions
  const requestHelp = useCallback(
    (level?: HelpLevel) => {
      if (!isAvailable) return

      const targetLevel = level ?? (Math.min(currentLevel + 1, 3) as HelpLevel)

      // Check if advanced help requires approval
      if (!isBeginnerMode && settings.advancedRequiresApproval && targetLevel >= 2) {
        // In teacher-approved mode, this would trigger an approval request
        // For now, we just don't escalate past L1 automatically
        if (settings.helpMode === 'teacher-approved' && targetLevel > 1) {
          // TODO: Trigger approval request
          return
        }
      }

      setCurrentLevel(targetLevel)
      setTrigger('manual')
      if (targetLevel > maxLevelUsed) {
        setMaxLevelUsed(targetLevel)
        onMaxLevelUpdate?.(targetLevel)
      }
      onHelpLevelChange?.(targetLevel, 'manual')
    },
    [
      currentLevel,
      isAvailable,
      isBeginnerMode,
      settings,
      maxLevelUsed,
      onHelpLevelChange,
      onMaxLevelUpdate,
    ]
  )

  const escalateHelp = useCallback(() => {
    if (currentLevel < 3) {
      requestHelp((currentLevel + 1) as HelpLevel)
    }
  }, [currentLevel, requestHelp])

  const resetForNewTerm = useCallback((context: TermContext) => {
    setTermContext(context)
    setCurrentLevel(0)
    setMaxLevelUsed(0)
    setTrigger('none')
    setErrorCount(0)
    setStartTime(null)
    setElapsedTimeMs(0)
  }, [])

  const dismissHelp = useCallback(() => {
    setCurrentLevel(0)
    setTrigger('none')
  }, [])

  const recordError = useCallback(() => {
    setErrorCount((prev) => prev + 1)
  }, [])

  const state: PracticeHelpState = {
    currentLevel,
    content,
    maxLevelUsed,
    isAvailable,
    elapsedTimeMs,
    trigger,
  }

  const actions: PracticeHelpActions = {
    requestHelp,
    escalateHelp,
    resetForNewTerm,
    dismissHelp,
    recordError,
  }

  return [state, actions]
}

export default usePracticeHelp
