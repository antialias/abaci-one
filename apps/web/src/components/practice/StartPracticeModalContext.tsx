'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import type { SessionPlan, GameBreakSelectionMode } from '@/db/schema/session-plans'
import { DEFAULT_PLAN_CONFIG, DEFAULT_GAME_BREAK_SETTINGS } from '@/db/schema/session-plans'
import { getPracticeApprovedGames } from '@/lib/arcade/practice-approved-games'
import {
  ActiveSessionExistsClientError,
  NoSkillsEnabledClientError,
  sessionPlanKeys,
  useApproveSessionPlan,
  useGenerateSessionPlan,
  useStartSessionPlan,
} from '@/hooks/useSessionPlan'
import type { SessionMode } from '@/lib/curriculum/session-mode'
import {
  convertSecondsPerProblemToSpt,
  estimateSessionProblemCount,
  TIME_ESTIMATION_DEFAULTS,
} from '@/lib/curriculum/time-estimation'
import {
  getSkillTutorialConfig,
  type SkillTutorialConfig,
} from '@/lib/curriculum/skill-tutorial-config'

// Part types configuration
export const PART_TYPES = [
  { type: 'abacus' as const, emoji: '🧮', label: 'Abacus', enabled: true },
  { type: 'visualization' as const, emoji: '🧠', label: 'Visualize', enabled: true },
  { type: 'linear' as const, emoji: '💭', label: 'Linear', enabled: false }, // Disabled for now
] as const

export type EnabledParts = {
  abacus: boolean
  visualization: boolean
  linear: boolean
}

export type PartType = 'abacus' | 'visualization' | 'linear'

// Game info type from practice-approved-games
type GameInfo = ReturnType<typeof getPracticeApprovedGames>[number]

interface StartPracticeModalContextValue {
  // Read-only props from parent
  studentId: string
  studentName: string
  focusDescription: string
  sessionMode: SessionMode
  existingPlan: SessionPlan | null

  // Session config (state + setters)
  durationMinutes: number
  setDurationMinutes: (min: number) => void
  enabledParts: EnabledParts
  togglePart: (partType: keyof EnabledParts) => void
  abacusMaxTerms: number
  setAbacusMaxTerms: (terms: number) => void

  // Game break config (state + setters)
  gameBreakEnabled: boolean
  setGameBreakEnabled: (enabled: boolean) => void
  gameBreakMinutes: number
  setGameBreakMinutes: (mins: number) => void
  gameBreakSelectionMode: GameBreakSelectionMode
  setGameBreakSelectionMode: (mode: GameBreakSelectionMode) => void
  gameBreakSelectedGame: string | 'random' | null
  setGameBreakSelectedGame: (game: string | 'random' | null) => void

  // Derived values
  secondsPerTerm: number
  avgTermsPerProblem: number
  problemsPerType: { abacus: number; visualization: number; linear: number }
  estimatedProblems: number
  enabledPartCount: number
  showGameBreakSettings: boolean
  practiceApprovedGames: GameInfo[]
  /** True when only one game is available for practice breaks */
  hasSingleGame: boolean
  /** The single game info when hasSingleGame is true, null otherwise */
  singleGame: GameInfo | null
  modesSummary: { text: string; emojis: string }

  // Tutorial/remediation derived values
  tutorialConfig: SkillTutorialConfig | null
  showTutorialGate: boolean
  showRemediationCta: boolean
  nextSkill: { skillId: string; displayName: string } | null

  // UI state
  isExpanded: boolean
  setIsExpanded: (expanded: boolean) => void

  // Mutation state
  isStarting: boolean
  displayError: Error | null
  isNoSkillsError: boolean

  // Actions
  handleStart: () => Promise<void>
  resetMutations: () => void
}

const StartPracticeModalContext = createContext<StartPracticeModalContextValue | null>(null)

export function useStartPracticeModal() {
  const context = useContext(StartPracticeModalContext)
  if (!context) {
    throw new Error('useStartPracticeModal must be used within StartPracticeModalProvider')
  }
  return context
}

interface StartPracticeModalProviderProps {
  children: ReactNode
  studentId: string
  studentName: string
  focusDescription: string
  sessionMode: SessionMode
  secondsPerTerm?: number
  avgSecondsPerProblem?: number
  existingPlan?: SessionPlan | null
  onStarted?: () => void
  /** Initial expanded state for settings panel (for Storybook) */
  initialExpanded?: boolean
  /** Override practice-approved games list (for Storybook/testing) */
  practiceApprovedGamesOverride?: GameInfo[]
}

export function StartPracticeModalProvider({
  children,
  studentId,
  studentName,
  focusDescription,
  sessionMode,
  secondsPerTerm: secondsPerTermProp,
  avgSecondsPerProblem,
  existingPlan = null,
  onStarted,
  initialExpanded = false,
  practiceApprovedGamesOverride,
}: StartPracticeModalProviderProps) {
  const router = useRouter()
  const queryClient = useQueryClient()

  // Session config state
  const [durationMinutes, setDurationMinutes] = useState(existingPlan?.targetDurationMinutes ?? 10)
  const [isExpanded, setIsExpanded] = useState(initialExpanded)
  const [enabledParts, setEnabledParts] = useState<EnabledParts>({
    abacus: true,
    visualization: true,
    linear: false,
  })
  const [abacusMaxTerms, setAbacusMaxTerms] = useState(
    DEFAULT_PLAN_CONFIG.abacusTermCount?.max ?? 5
  )

  // Game break config state
  const [gameBreakEnabled, setGameBreakEnabled] = useState(DEFAULT_GAME_BREAK_SETTINGS.enabled)
  const [gameBreakMinutes, setGameBreakMinutes] = useState(
    DEFAULT_GAME_BREAK_SETTINGS.maxDurationMinutes
  )
  const [gameBreakSelectionMode, setGameBreakSelectionMode] = useState<GameBreakSelectionMode>(
    DEFAULT_GAME_BREAK_SETTINGS.selectionMode
  )
  const [gameBreakSelectedGame, setGameBreakSelectedGame] = useState<string | 'random' | null>(
    DEFAULT_GAME_BREAK_SETTINGS.selectedGame
  )

  // Toggle part helper
  const togglePart = useCallback((partType: keyof EnabledParts) => {
    setEnabledParts((prev) => {
      const enabledCount = Object.values(prev).filter(Boolean).length
      if (enabledCount === 1 && prev[partType]) return prev
      return { ...prev, [partType]: !prev[partType] }
    })
  }, [])

  // Derived values
  const secondsPerTerm = useMemo(() => {
    if (secondsPerTermProp !== undefined) return secondsPerTermProp
    if (avgSecondsPerProblem !== undefined)
      return convertSecondsPerProblemToSpt(avgSecondsPerProblem)
    return TIME_ESTIMATION_DEFAULTS.secondsPerTerm
  }, [secondsPerTermProp, avgSecondsPerProblem])

  const avgTermsPerProblem = useMemo(() => {
    return (3 + abacusMaxTerms) / 2
  }, [abacusMaxTerms])

  const practiceApprovedGames = useMemo(
    () => practiceApprovedGamesOverride ?? getPracticeApprovedGames(),
    [practiceApprovedGamesOverride]
  )
  const hasSingleGame = practiceApprovedGames.length === 1
  const singleGame = hasSingleGame ? practiceApprovedGames[0] : null

  // Auto-select single game when only one is available
  useEffect(() => {
    if (hasSingleGame && singleGame) {
      setGameBreakSelectedGame(singleGame.manifest.name)
      // Force auto-start mode when there's only one game
      setGameBreakSelectionMode('auto-start')
    }
  }, [hasSingleGame, singleGame])

  const problemsPerType = useMemo(() => {
    const enabledPartTypes = PART_TYPES.filter((p) => enabledParts[p.type]).map((p) => p.type)
    const enabledCount = enabledPartTypes.length
    if (enabledCount === 0) {
      return { abacus: 0, visualization: 0, linear: 0 }
    }

    const minutesPerPart = durationMinutes / enabledCount

    return {
      abacus: enabledParts.abacus
        ? estimateSessionProblemCount(minutesPerPart, avgTermsPerProblem, secondsPerTerm, 'abacus')
        : 0,
      visualization: enabledParts.visualization
        ? estimateSessionProblemCount(
            minutesPerPart,
            avgTermsPerProblem,
            secondsPerTerm,
            'visualization'
          )
        : 0,
      linear: enabledParts.linear
        ? estimateSessionProblemCount(minutesPerPart, avgTermsPerProblem, secondsPerTerm, 'linear')
        : 0,
    }
  }, [durationMinutes, enabledParts, avgTermsPerProblem, secondsPerTerm])

  const estimatedProblems = useMemo(() => {
    return problemsPerType.abacus + problemsPerType.visualization + problemsPerType.linear
  }, [problemsPerType])

  const modesSummary = useMemo(() => {
    const availableParts = PART_TYPES.filter((p) => p.enabled)
    const enabled = availableParts.filter((p) => enabledParts[p.type])
    if (enabled.length === availableParts.length)
      return { text: 'all modes', emojis: enabled.map((p) => p.emoji).join('') }
    if (enabled.length === 0) return { text: 'none', emojis: '—' }
    return {
      text: `${enabled.length} mode${enabled.length > 1 ? 's' : ''}`,
      emojis: enabled.map((p) => p.emoji).join(''),
    }
  }, [enabledParts])

  const enabledPartCount = useMemo(() => {
    return PART_TYPES.filter((p) => p.enabled && enabledParts[p.type]).length
  }, [enabledParts])

  const showGameBreakSettings = enabledPartCount >= 2

  // Tutorial/remediation derived values
  const tutorialConfig = useMemo(() => {
    if (sessionMode.type !== 'progression' || !sessionMode.tutorialRequired) return null
    return getSkillTutorialConfig(sessionMode.nextSkill.skillId)
  }, [sessionMode])

  const nextSkill = sessionMode.type === 'progression' ? sessionMode.nextSkill : null

  const showTutorialGate = !!tutorialConfig
  const showRemediationCta = sessionMode.type === 'remediation' && sessionMode.weakSkills.length > 0

  // Mutations
  const generatePlan = useGenerateSessionPlan()
  const approvePlan = useApproveSessionPlan()
  const startPlan = useStartSessionPlan()

  const isStarting = generatePlan.isPending || approvePlan.isPending || startPlan.isPending

  const displayError = useMemo(() => {
    if (generatePlan.error && !(generatePlan.error instanceof ActiveSessionExistsClientError)) {
      return generatePlan.error
    }
    if (approvePlan.error) return approvePlan.error
    if (startPlan.error) return startPlan.error
    return null
  }, [generatePlan.error, approvePlan.error, startPlan.error])

  const isNoSkillsError = displayError instanceof NoSkillsEnabledClientError

  const resetMutations = useCallback(() => {
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()
  }, [generatePlan, approvePlan, startPlan])

  const handleStart = useCallback(async () => {
    resetMutations()

    try {
      let plan: SessionPlan

      if (existingPlan && existingPlan.targetDurationMinutes === durationMinutes) {
        plan = existingPlan
      } else {
        try {
          plan = await generatePlan.mutateAsync({
            playerId: studentId,
            durationMinutes,
            abacusTermCount: { min: 3, max: abacusMaxTerms },
            enabledParts,
            problemGenerationMode: 'adaptive-bkt',
            sessionMode,
            gameBreakSettings: {
              enabled: gameBreakEnabled,
              maxDurationMinutes: gameBreakMinutes,
              selectionMode: gameBreakSelectionMode,
              selectedGame: gameBreakEnabled ? gameBreakSelectedGame : null,
            },
          })
        } catch (err) {
          if (err instanceof ActiveSessionExistsClientError) {
            plan = err.existingPlan
            queryClient.setQueryData(sessionPlanKeys.active(studentId), plan)
          } else {
            throw err
          }
        }
      }

      await approvePlan.mutateAsync({ playerId: studentId, planId: plan.id })
      await startPlan.mutateAsync({ playerId: studentId, planId: plan.id })
      onStarted?.()
      router.push(`/practice/${studentId}`, { scroll: false })
    } catch {
      // Error will show in UI
    }
  }, [
    studentId,
    durationMinutes,
    abacusMaxTerms,
    enabledParts,
    existingPlan,
    sessionMode,
    gameBreakEnabled,
    gameBreakMinutes,
    gameBreakSelectionMode,
    gameBreakSelectedGame,
    generatePlan,
    approvePlan,
    startPlan,
    queryClient,
    router,
    onStarted,
    resetMutations,
  ])

  const value: StartPracticeModalContextValue = {
    // Read-only props
    studentId,
    studentName,
    focusDescription,
    sessionMode,
    existingPlan,

    // Session config
    durationMinutes,
    setDurationMinutes,
    enabledParts,
    togglePart,
    abacusMaxTerms,
    setAbacusMaxTerms,

    // Game break config
    gameBreakEnabled,
    setGameBreakEnabled,
    gameBreakMinutes,
    setGameBreakMinutes,
    gameBreakSelectionMode,
    setGameBreakSelectionMode,
    gameBreakSelectedGame,
    setGameBreakSelectedGame,

    // Derived values
    secondsPerTerm,
    avgTermsPerProblem,
    problemsPerType,
    estimatedProblems,
    enabledPartCount,
    showGameBreakSettings,
    practiceApprovedGames,
    hasSingleGame,
    singleGame,
    modesSummary,

    // Tutorial/remediation
    tutorialConfig,
    showTutorialGate,
    showRemediationCta,
    nextSkill,

    // UI state
    isExpanded,
    setIsExpanded,

    // Mutation state
    isStarting,
    displayError,
    isNoSkillsError,

    // Actions
    handleStart,
    resetMutations,
  }

  return (
    <StartPracticeModalContext.Provider value={value}>
      {children}
    </StartPracticeModalContext.Provider>
  )
}
