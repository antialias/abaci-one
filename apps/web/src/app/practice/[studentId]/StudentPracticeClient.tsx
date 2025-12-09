'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageWithNav } from '@/components/PageWithNav'
import {
  ActiveSession,
  ContinueSessionCard,
  type CurrentPhaseInfo,
  PlanReview,
  PracticeErrorBoundary,
  ProgressDashboard,
  SessionSummary,
  type SkillProgress,
  type StudentWithProgress,
} from '@/components/practice'
import { ManualSkillSelector } from '@/components/practice/ManualSkillSelector'
import {
  type OfflineSessionData,
  OfflineSessionForm,
} from '@/components/practice/OfflineSessionForm'
import { useTheme } from '@/contexts/ThemeContext'
import type { PlayerCurriculum } from '@/db/schema/player-curriculum'
import type { PlayerSkillMastery } from '@/db/schema/player-skill-mastery'
import type { Player } from '@/db/schema/players'
import type { PracticeSession } from '@/db/schema/practice-sessions'
import type { SessionPlan, SlotResult } from '@/db/schema/session-plans'
import {
  useAbandonSession,
  useActiveSessionPlan,
  useApproveSessionPlan,
  useEndSessionEarly,
  useGenerateSessionPlan,
  useRecordSlotResult,
  useStartSessionPlan,
} from '@/hooks/useSessionPlan'
import { css } from '../../../../styled-system/css'

// Mock curriculum phase data (until we integrate with actual curriculum)
function getPhaseInfo(phaseId: string): CurrentPhaseInfo {
  // Parse phase ID format: L{level}.{operation}.{number}.{technique}
  const parts = phaseId.split('.')
  const level = parts[0]?.replace('L', '') || '1'
  const operation = parts[1] || 'add'
  const number = parts[2] || '+1'
  const technique = parts[3] || 'direct'

  const operationName = operation === 'add' ? 'Addition' : 'Subtraction'
  const techniqueName =
    technique === 'direct'
      ? 'Direct Method'
      : technique === 'five'
        ? 'Five Complement'
        : technique === 'ten'
          ? 'Ten Complement'
          : technique

  return {
    phaseId,
    levelName: `Level ${level}`,
    phaseName: `${operationName}: ${number} (${techniqueName})`,
    description: `Practice ${operation === 'add' ? 'adding' : 'subtracting'} ${number.replace('+', '').replace('-', '')} using the ${techniqueName.toLowerCase()}.`,
    skillsToMaster: [`${operation}.${number}.${technique}`],
    masteredSkills: 0,
    totalSkills: 1,
  }
}

// View is derived from session plan state, not managed separately
type SessionView = 'dashboard' | 'continue' | 'reviewing' | 'practicing' | 'summary'

interface CurriculumData {
  curriculum: PlayerCurriculum | null
  skills: PlayerSkillMastery[]
  recentSessions: PracticeSession[]
}

interface StudentPracticeClientProps {
  studentId: string
  initialPlayer: Player
  initialActiveSession: SessionPlan | null
  initialCurriculum: CurriculumData
}

/**
 * Client component for student practice page
 *
 * Receives prefetched data as props from server component.
 * This avoids SSR hydration issues with React Query.
 */
export function StudentPracticeClient({
  studentId,
  initialPlayer,
  initialActiveSession,
  initialCurriculum,
}: StudentPracticeClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Use initial data from server props
  const player = initialPlayer
  const curriculumData = initialCurriculum

  // Modal states for onboarding features
  const [showManualSkillModal, setShowManualSkillModal] = useState(false)
  const [showOfflineSessionModal, setShowOfflineSessionModal] = useState(false)

  // Build the student object
  const selectedStudent: StudentWithProgress = {
    id: player.id,
    name: player.name,
    emoji: player.emoji,
    color: player.color,
    createdAt: player.createdAt,
  }

  // Session plan mutations
  const generatePlan = useGenerateSessionPlan()
  const approvePlan = useApproveSessionPlan()
  const startPlan = useStartSessionPlan()
  const recordResult = useRecordSlotResult()
  const endEarly = useEndSessionEarly()
  const abandonSession = useAbandonSession()

  // Fetch active session plan from cache or API
  // - If cache has data (from ConfigureClient mutation): uses cache immediately
  // - If no cache but initialActiveSession exists: uses server props as initial data
  // - If neither: fetches from API (shows loading state briefly)
  const {
    data: fetchedPlan,
    isLoading: isPlanLoading,
  } = useActiveSessionPlan(studentId, initialActiveSession)

  // Current plan from mutations or fetched data (priority order)
  // Mutations take priority (most recent user action), then fetched/cached data
  const currentPlan =
    recordResult.data ??
    startPlan.data ??
    approvePlan.data ??
    generatePlan.data ??
    fetchedPlan ??
    null

  // Derive error state from mutations
  const error =
    startPlan.error || approvePlan.error
      ? {
          context: 'start' as const,
          message: 'Unable to start practice session',
          suggestion:
            'The plan was created but could not be started. Try clicking "Let\'s Go!" again, or go back and create a new plan.',
        }
      : null

  // Derive view from session plan state - NO useState!
  // This eliminates the "bastard state" problem where viewState and currentPlan could diverge
  const sessionView: SessionView | 'loading' = useMemo(() => {
    // Show loading only if we're fetching AND don't have any data yet
    // (mutations or initial data would give us something to show)
    if (isPlanLoading && !currentPlan) return 'loading'
    if (!currentPlan) return 'dashboard'
    if (currentPlan.completedAt) return 'summary'
    if (currentPlan.startedAt) return 'practicing'
    if (currentPlan.approvedAt) return 'reviewing'
    return 'continue' // Plan exists but not yet approved (draft)
  }, [currentPlan, isPlanLoading])

  // Handle continue practice - navigate to configuration page
  const handleContinuePractice = useCallback(() => {
    router.push(`/practice/${studentId}/configure`, { scroll: false })
  }, [studentId, router])

  // Handle resuming an existing session
  const handleResumeSession = useCallback(() => {
    if (!currentPlan) return

    // Session already started → navigate to main practice page (no ?returning)
    if (currentPlan.startedAt) {
      router.push(`/practice/${studentId}`, { scroll: false })
      return
    }

    // Approved but not started → start it
    if (currentPlan.approvedAt) {
      startPlan.mutate({ playerId: studentId, planId: currentPlan.id })
      return
    }

    // Draft (not approved) → need to approve it first
    // This will update sessionView to 'reviewing'
    approvePlan.mutate({ playerId: studentId, planId: currentPlan.id })
  }, [currentPlan, studentId, startPlan, approvePlan, router])

  // Handle starting fresh (abandon current session)
  const handleStartFresh = useCallback(() => {
    if (!currentPlan) return

    abandonSession.mutate(
      { playerId: studentId, planId: currentPlan.id },
      {
        onSuccess: () => {
          // Navigate to configure page for a fresh start
          router.push(`/practice/${studentId}/configure`, { scroll: false })
        },
      }
    )
  }, [studentId, currentPlan, abandonSession, router])

  // Handle approving the plan (approve + start in sequence)
  // View will update automatically via derived state when mutations complete
  const handleApprovePlan = useCallback(() => {
    if (!currentPlan) return

    approvePlan.reset()
    startPlan.reset()

    // First approve, then start - view updates automatically from derived state
    approvePlan.mutate(
      { playerId: studentId, planId: currentPlan.id },
      {
        onSuccess: () => {
          startPlan.mutate({ playerId: studentId, planId: currentPlan.id })
        },
      }
    )
  }, [studentId, currentPlan, approvePlan, startPlan])

  // Handle canceling the plan review - navigate to configure page
  const handleCancelPlan = useCallback(() => {
    // Abandon the current plan and go to configure
    if (currentPlan) {
      abandonSession.mutate(
        { playerId: studentId, planId: currentPlan.id },
        {
          onSuccess: () => {
            router.push(`/practice/${studentId}/configure`, { scroll: false })
          },
        }
      )
    } else {
      router.push(`/practice/${studentId}/configure`, { scroll: false })
    }
  }, [studentId, currentPlan, abandonSession, router])

  // Handle recording an answer
  const handleAnswer = useCallback(
    async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>): Promise<void> => {
      if (!currentPlan) return

      await recordResult.mutateAsync({
        playerId: studentId,
        planId: currentPlan.id,
        result,
      })
    },
    [studentId, currentPlan, recordResult]
  )

  // Handle ending session early
  // View will update automatically to 'summary' when completedAt is set
  const handleEndEarly = useCallback(
    (reason?: string) => {
      if (!currentPlan) return

      endEarly.mutate({
        playerId: studentId,
        planId: currentPlan.id,
        reason,
      })
      // View updates automatically via derived state when completedAt is set
    },
    [studentId, currentPlan, endEarly]
  )

  // Handle session completion - view updates automatically via derived state
  const handleSessionComplete = useCallback(() => {
    // The session is marked complete by the ActiveSession component
    // View will automatically show 'summary' when completedAt is set
  }, [])

  // Handle practice again - navigate to configure page
  const handlePracticeAgain = useCallback(() => {
    // Reset all mutations to clear the plan from cache
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()
    recordResult.reset()
    endEarly.reset()
    abandonSession.reset()
    // Navigate to configure page for new session
    router.push(`/practice/${studentId}/configure`, { scroll: false })
  }, [
    generatePlan,
    approvePlan,
    startPlan,
    recordResult,
    endEarly,
    abandonSession,
    router,
    studentId,
  ])

  // Handle back to dashboard - just reset mutations and let derived state show dashboard
  const handleBackToDashboard = useCallback(() => {
    // Reset all mutations to clear the plan from cache
    // Completed sessions don't need abandonment - they stay in DB for teacher review
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()
    recordResult.reset()
    endEarly.reset()
    abandonSession.reset()
    // With mutations cleared, currentPlan becomes null (only initialActiveSession which was completed)
    // sessionView will automatically become 'dashboard'
  }, [generatePlan, approvePlan, startPlan, recordResult, endEarly, abandonSession])

  // Handle view full progress (not yet implemented)
  const handleViewFullProgress = useCallback(() => {
    // TODO: Navigate to detailed progress view when implemented
  }, [])

  // Handle generate worksheet
  const handleGenerateWorksheet = useCallback(() => {
    // Navigate to worksheet generator with student's current level
    window.location.href = '/create/worksheets/addition'
  }, [])

  // Handle opening placement test - navigate to placement test route
  const handleRunPlacementTest = useCallback(() => {
    router.push(`/practice/${studentId}/placement-test`, { scroll: false })
  }, [studentId, router])

  // Handle opening manual skill selector
  const handleSetSkillsManually = useCallback(() => {
    setShowManualSkillModal(true)
  }, [])

  // Handle saving manual skill selections
  const handleSaveManualSkills = useCallback(async (masteredSkillIds: string[]): Promise<void> => {
    // TODO: Save skills to curriculum via API
    console.log('Manual skills saved:', masteredSkillIds)
    setShowManualSkillModal(false)
  }, [])

  // Handle opening offline session form
  const handleRecordOfflinePractice = useCallback(() => {
    setShowOfflineSessionModal(true)
  }, [])

  // Handle submitting offline session
  const handleSubmitOfflineSession = useCallback(
    async (data: OfflineSessionData): Promise<void> => {
      // TODO: Save offline session to database via API
      console.log('Offline session recorded:', data)
      setShowOfflineSessionModal(false)
    },
    []
  )

  // Build current phase info from curriculum
  const currentPhase = curriculumData.curriculum
    ? getPhaseInfo(curriculumData.curriculum.currentPhaseId)
    : getPhaseInfo('L1.add.+1.direct')

  // Update phase info with actual skill mastery
  if (curriculumData.skills.length > 0) {
    const phaseSkills = curriculumData.skills.filter((s) =>
      currentPhase.skillsToMaster.includes(s.skillId)
    )
    currentPhase.masteredSkills = phaseSkills.filter((s) => s.masteryLevel === 'mastered').length
    currentPhase.totalSkills = currentPhase.skillsToMaster.length
  }

  // Map skills to display format
  const recentSkills: SkillProgress[] = curriculumData.skills.slice(0, 5).map((s) => ({
    skillId: s.skillId,
    skillName: formatSkillName(s.skillId),
    masteryLevel: s.masteryLevel,
    attempts: s.attempts,
    correct: s.correct,
    consecutiveCorrect: s.consecutiveCorrect,
  }))

  // Format skill ID to human-readable name
  function formatSkillName(skillId: string): string {
    // Example: "add.+3.direct" -> "+3 Direct"
    const parts = skillId.split('.')
    if (parts.length >= 2) {
      const number = parts[1] || skillId
      const technique = parts[2]
      const techLabel =
        technique === 'direct'
          ? ''
          : technique === 'five'
            ? ' (5s)'
            : technique === 'ten'
              ? ' (10s)'
              : ''
      return `${number}${techLabel}`
    }
    return skillId
  }

  return (
    <PageWithNav>
      <main
        data-component="practice-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: sessionView === 'practicing' ? '80px' : 'calc(80px + 2rem)',
          paddingLeft: sessionView === 'practicing' ? '0' : '2rem',
          paddingRight: sessionView === 'practicing' ? '0' : '2rem',
          paddingBottom: sessionView === 'practicing' ? '0' : '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: sessionView === 'practicing' ? '100%' : '800px',
            margin: '0 auto',
          })}
        >
          {/* Header - hide during practice */}
          {sessionView !== 'practicing' && (
            <header
              className={css({
                textAlign: 'center',
                marginBottom: '2rem',
              })}
            >
              <h1
                className={css({
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  color: isDark ? 'white' : 'gray.800',
                  marginBottom: '0.5rem',
                })}
              >
                Daily Practice
              </h1>
              <p
                className={css({
                  fontSize: '1rem',
                  color: isDark ? 'gray.400' : 'gray.600',
                })}
              >
                Build your soroban skills one step at a time
              </p>
            </header>
          )}

          {/* Content based on session view (derived from data) */}
          {sessionView === 'loading' && (
            <div
              data-section="loading"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '3rem',
                gap: '1rem',
              })}
            >
              <div
                className={css({
                  fontSize: '2rem',
                  animation: 'pulse 1.5s ease-in-out infinite',
                })}
              >
                Loading practice session...
              </div>
            </div>
          )}

          {sessionView === 'continue' && currentPlan && (
            <ContinueSessionCard
              studentName={selectedStudent.name}
              studentEmoji={selectedStudent.emoji}
              studentColor={selectedStudent.color}
              session={currentPlan}
              onContinue={handleResumeSession}
              onStartFresh={handleStartFresh}
            />
          )}

          {sessionView === 'dashboard' && (
            <ProgressDashboard
              student={selectedStudent}
              currentPhase={currentPhase}
              recentSkills={recentSkills}
              onContinuePractice={handleContinuePractice}
              onViewFullProgress={handleViewFullProgress}
              onGenerateWorksheet={handleGenerateWorksheet}
              onRunPlacementTest={handleRunPlacementTest}
              onSetSkillsManually={handleSetSkillsManually}
              onRecordOfflinePractice={handleRecordOfflinePractice}
            />
          )}

          {sessionView === 'reviewing' && currentPlan && (
            <div data-section="plan-review-wrapper">
              {/* Error display for session start */}
              {error?.context === 'start' && (
                <div
                  data-element="error-banner"
                  className={css({
                    padding: '1rem',
                    marginBottom: '1rem',
                    backgroundColor: 'red.50',
                    borderRadius: '12px',
                    border: '1px solid',
                    borderColor: 'red.200',
                    maxWidth: '600px',
                    margin: '0 auto 1rem auto',
                  })}
                >
                  <div
                    className={css({
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.75rem',
                    })}
                  >
                    <span className={css({ fontSize: '1.25rem' })}>⚠️</span>
                    <div>
                      <div
                        className={css({
                          fontWeight: 'bold',
                          color: 'red.700',
                          marginBottom: '0.25rem',
                        })}
                      >
                        {error.message}
                      </div>
                      <div className={css({ fontSize: '0.875rem', color: 'red.600' })}>
                        {error.suggestion}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <PlanReview
                plan={currentPlan}
                studentName={selectedStudent.name}
                onApprove={handleApprovePlan}
                onCancel={handleCancelPlan}
              />
            </div>
          )}

          {sessionView === 'practicing' && currentPlan && (
            <PracticeErrorBoundary studentName={selectedStudent.name}>
              <ActiveSession
                plan={currentPlan}
                studentName={selectedStudent.name}
                onAnswer={handleAnswer}
                onEndEarly={handleEndEarly}
                onComplete={handleSessionComplete}
              />
            </PracticeErrorBoundary>
          )}

          {sessionView === 'summary' && currentPlan && (
            <SessionSummary
              plan={currentPlan}
              studentName={selectedStudent.name}
              onPracticeAgain={handlePracticeAgain}
              onBackToDashboard={handleBackToDashboard}
            />
          )}
        </div>

        {/* Manual Skill Selector Modal */}
        <ManualSkillSelector
          studentName={selectedStudent.name}
          playerId={selectedStudent.id}
          open={showManualSkillModal}
          onClose={() => setShowManualSkillModal(false)}
          onSave={handleSaveManualSkills}
        />

        {/* Offline Session Form Modal */}
        <OfflineSessionForm
          studentName={selectedStudent.name}
          playerId={selectedStudent.id}
          open={showOfflineSessionModal}
          onClose={() => setShowOfflineSessionModal(false)}
          onSubmit={handleSubmitOfflineSession}
        />
      </main>
    </PageWithNav>
  )
}
