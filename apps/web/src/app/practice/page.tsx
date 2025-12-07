'use client'

import { useCallback, useState } from 'react'
import {
  ActiveSession,
  type CurrentPhaseInfo,
  PlanReview,
  ProgressDashboard,
  SessionSummary,
  type SkillProgress,
  StudentSelector,
  type StudentWithProgress,
} from '@/components/practice'
import { ManualSkillSelector } from '@/components/practice/ManualSkillSelector'
import {
  type OfflineSessionData,
  OfflineSessionForm,
} from '@/components/practice/OfflineSessionForm'
import { PlacementTest } from '@/components/practice/PlacementTest'
import { PageWithNav } from '@/components/PageWithNav'
import { useTheme } from '@/contexts/ThemeContext'
import type { SlotResult } from '@/db/schema/session-plans'
import { usePlayerCurriculum } from '@/hooks/usePlayerCurriculum'
import {
  useApproveSessionPlan,
  useEndSessionEarly,
  useGenerateSessionPlan,
  useRecordSlotResult,
  useStartSessionPlan,
} from '@/hooks/useSessionPlan'
import { useUserPlayers } from '@/hooks/useUserPlayers'
import { css } from '../../../styled-system/css'

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

type ViewState =
  | 'selecting'
  | 'dashboard'
  | 'configuring'
  | 'reviewing'
  | 'practicing'
  | 'summary'
  | 'creating'
  | 'placement-test'

interface SessionConfig {
  durationMinutes: number
}

/**
 * Practice page - Entry point for student practice sessions
 *
 * Flow:
 * 1. Show StudentSelector to choose which student is practicing
 * 2. Show ProgressDashboard with current progress and actions
 * 3. Configure session (duration, mode)
 * 4. Review generated plan
 * 5. Practice!
 * 6. View summary
 */
export default function PracticePage() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const [viewState, setViewState] = useState<ViewState>('selecting')
  const [selectedStudent, setSelectedStudent] = useState<StudentWithProgress | null>(null)
  const [sessionConfig, setSessionConfig] = useState<SessionConfig>({
    durationMinutes: 10,
  })

  // Modal states for onboarding features
  const [showManualSkillModal, setShowManualSkillModal] = useState(false)
  const [showOfflineSessionModal, setShowOfflineSessionModal] = useState(false)

  // React Query hooks for players
  const { data: players = [], isLoading: isLoadingStudents } = useUserPlayers()

  // Get curriculum data for selected student
  const curriculum = usePlayerCurriculum(selectedStudent?.id ?? null)

  // Session plan mutations
  const generatePlan = useGenerateSessionPlan()
  const approvePlan = useApproveSessionPlan()
  const startPlan = useStartSessionPlan()
  const recordResult = useRecordSlotResult()
  const endEarly = useEndSessionEarly()

  // Current plan from mutations (use the latest successful result)
  const currentPlan =
    recordResult.data ?? startPlan.data ?? approvePlan.data ?? generatePlan.data ?? null

  // Derive error state from mutations
  const error = generatePlan.error
    ? {
        context: 'generate' as const,
        message: 'Unable to create practice plan',
        suggestion:
          'This may be a temporary issue. Try selecting a different duration or refresh the page.',
      }
    : startPlan.error || approvePlan.error
      ? {
          context: 'start' as const,
          message: 'Unable to start practice session',
          suggestion:
            'The plan was created but could not be started. Try clicking "Let\'s Go!" again, or go back and create a new plan.',
        }
      : null

  // Convert players to StudentWithProgress format
  // Note: For full curriculum enrichment, we'd need separate queries per player
  // For now, use basic player data
  const students: StudentWithProgress[] = players.map((player) => ({
    id: player.id,
    name: player.name,
    emoji: player.emoji,
    color: player.color,
    createdAt: player.createdAt,
  }))

  // Calculate mastery percentage from skills
  function calculateMasteryPercent(skills: Array<{ masteryLevel: string }>): number {
    if (skills.length === 0) return 0
    const mastered = skills.filter((s) => s.masteryLevel === 'mastered').length
    return Math.round((mastered / skills.length) * 100)
  }

  // Handle student selection
  const handleSelectStudent = useCallback((student: StudentWithProgress) => {
    setSelectedStudent(student)
    setViewState('dashboard')
  }, [])

  // Handle adding a new student
  const handleAddStudent = useCallback(() => {
    setViewState('creating')
  }, [])

  // Handle going back to student selection
  const handleChangeStudent = useCallback(() => {
    setSelectedStudent(null)
    // Reset all mutations to clear plan state
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()
    recordResult.reset()
    endEarly.reset()
    setViewState('selecting')
  }, [generatePlan, approvePlan, startPlan, recordResult, endEarly])

  // Handle continue practice - go to session configuration
  const handleContinuePractice = useCallback(() => {
    setViewState('configuring')
  }, [])

  // Handle generating a session plan
  const handleGeneratePlan = useCallback(() => {
    if (!selectedStudent) return

    generatePlan.reset() // Clear any previous errors
    generatePlan.mutate(
      {
        playerId: selectedStudent.id,
        durationMinutes: sessionConfig.durationMinutes,
      },
      {
        onSuccess: () => {
          setViewState('reviewing')
        },
      }
    )
  }, [selectedStudent, sessionConfig, generatePlan])

  // Handle approving the plan (approve + start in sequence)
  const handleApprovePlan = useCallback(() => {
    if (!selectedStudent || !currentPlan) return

    approvePlan.reset()
    startPlan.reset()

    // First approve, then start
    approvePlan.mutate(
      { playerId: selectedStudent.id, planId: currentPlan.id },
      {
        onSuccess: () => {
          startPlan.mutate(
            { playerId: selectedStudent.id, planId: currentPlan.id },
            {
              onSuccess: () => {
                setViewState('practicing')
              },
            }
          )
        },
      }
    )
  }, [selectedStudent, currentPlan, approvePlan, startPlan])

  // Handle canceling the plan review
  const handleCancelPlan = useCallback(() => {
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()
    setViewState('configuring')
  }, [generatePlan, approvePlan, startPlan])

  // Handle recording an answer
  const handleAnswer = useCallback(
    async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>): Promise<void> => {
      if (!selectedStudent || !currentPlan) return

      await recordResult.mutateAsync({
        playerId: selectedStudent.id,
        planId: currentPlan.id,
        result,
      })
    },
    [selectedStudent, currentPlan, recordResult]
  )

  // Handle ending session early
  const handleEndEarly = useCallback(
    (reason?: string) => {
      if (!selectedStudent || !currentPlan) return

      endEarly.mutate(
        {
          playerId: selectedStudent.id,
          planId: currentPlan.id,
          reason,
        },
        {
          onSuccess: () => {
            setViewState('summary')
          },
        }
      )
    },
    [selectedStudent, currentPlan, endEarly]
  )

  // Handle session completion
  const handleSessionComplete = useCallback(() => {
    setViewState('summary')
  }, [])

  // Handle practice again
  const handlePracticeAgain = useCallback(() => {
    // Reset all mutations to clear the plan
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()
    recordResult.reset()
    endEarly.reset()
    setViewState('configuring')
  }, [generatePlan, approvePlan, startPlan, recordResult, endEarly])

  // Handle back to dashboard
  const handleBackToDashboard = useCallback(() => {
    // Reset all mutations to clear the plan
    generatePlan.reset()
    approvePlan.reset()
    startPlan.reset()
    recordResult.reset()
    endEarly.reset()
    setViewState('dashboard')
  }, [generatePlan, approvePlan, startPlan, recordResult, endEarly])

  // Handle view full progress (not yet implemented)
  const handleViewFullProgress = useCallback(() => {
    // TODO: Navigate to detailed progress view when implemented
  }, [])

  // Handle generate worksheet
  const handleGenerateWorksheet = useCallback(() => {
    // Navigate to worksheet generator with student's current level
    window.location.href = '/create/worksheets/addition'
  }, [])

  // Handle opening placement test
  const handleRunPlacementTest = useCallback(() => {
    setViewState('placement-test')
  }, [])

  // Handle placement test completion
  const handlePlacementTestComplete = useCallback(
    (results: {
      masteredSkillIds: string[]
      practicingSkillIds: string[]
      totalProblems: number
      totalCorrect: number
    }) => {
      // TODO: Save results to curriculum via API
      console.log('Placement test complete:', results)
      // Return to dashboard after completion
      setViewState('dashboard')
    },
    []
  )

  // Handle placement test cancel
  const handlePlacementTestCancel = useCallback(() => {
    setViewState('dashboard')
  }, [])

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
  const currentPhase = curriculum.curriculum
    ? getPhaseInfo(curriculum.curriculum.currentPhaseId)
    : getPhaseInfo('L1.add.+1.direct')

  // Update phase info with actual skill mastery
  if (curriculum.skills.length > 0) {
    const phaseSkills = curriculum.skills.filter((s) =>
      currentPhase.skillsToMaster.includes(s.skillId)
    )
    currentPhase.masteredSkills = phaseSkills.filter((s) => s.masteryLevel === 'mastered').length
    currentPhase.totalSkills = currentPhase.skillsToMaster.length
  }

  // Map skills to display format
  const recentSkills: SkillProgress[] = curriculum.skills.slice(0, 5).map((s) => ({
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
          padding: viewState === 'practicing' ? '0' : '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: viewState === 'practicing' ? '100%' : '800px',
            margin: '0 auto',
          })}
        >
          {/* Header - hide during practice */}
          {viewState !== 'practicing' && (
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

          {/* Content based on view state */}
          {viewState === 'selecting' &&
            (isLoadingStudents ? (
              <div
                className={css({
                  textAlign: 'center',
                  padding: '3rem',
                  color: 'gray.500',
                })}
              >
                Loading students...
              </div>
            ) : (
              <StudentSelector
                students={students}
                selectedStudent={selectedStudent ?? undefined}
                onSelectStudent={handleSelectStudent}
                onAddStudent={handleAddStudent}
              />
            ))}

          {viewState === 'dashboard' && selectedStudent && (
            <ProgressDashboard
              student={selectedStudent}
              currentPhase={currentPhase}
              recentSkills={recentSkills}
              onContinuePractice={handleContinuePractice}
              onViewFullProgress={handleViewFullProgress}
              onGenerateWorksheet={handleGenerateWorksheet}
              onChangeStudent={handleChangeStudent}
              onRunPlacementTest={handleRunPlacementTest}
              onSetSkillsManually={handleSetSkillsManually}
              onRecordOfflinePractice={handleRecordOfflinePractice}
            />
          )}

          {viewState === 'configuring' && selectedStudent && (
            <div
              data-section="session-config"
              className={css({
                display: 'flex',
                flexDirection: 'column',
                gap: '1.5rem',
                padding: '2rem',
                backgroundColor: 'white',
                borderRadius: '16px',
                boxShadow: 'md',
              })}
            >
              <h2
                className={css({
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'gray.800',
                  textAlign: 'center',
                })}
              >
                Configure Practice Session
              </h2>

              {/* Duration selector */}
              <div>
                <label
                  className={css({
                    display: 'block',
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    color: 'gray.700',
                    marginBottom: '0.5rem',
                  })}
                >
                  Session Duration
                </label>
                <div
                  className={css({
                    display: 'flex',
                    gap: '0.5rem',
                  })}
                >
                  {[5, 10, 15, 20].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setSessionConfig((c) => ({ ...c, durationMinutes: mins }))}
                      className={css({
                        flex: 1,
                        padding: '1rem',
                        fontSize: '1.25rem',
                        fontWeight: 'bold',
                        color: sessionConfig.durationMinutes === mins ? 'white' : 'gray.700',
                        backgroundColor:
                          sessionConfig.durationMinutes === mins ? 'blue.500' : 'gray.100',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        _hover: {
                          backgroundColor:
                            sessionConfig.durationMinutes === mins ? 'blue.600' : 'gray.200',
                        },
                      })}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              {/* Session structure preview */}
              <div
                className={css({
                  padding: '1rem',
                  backgroundColor: 'gray.50',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: 'gray.200',
                })}
              >
                <div
                  className={css({
                    fontSize: '0.875rem',
                    fontWeight: 'bold',
                    color: 'gray.700',
                    marginBottom: '0.75rem',
                  })}
                >
                  Today's Practice Structure
                </div>
                <div
                  className={css({
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    fontSize: '0.875rem',
                  })}
                >
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                    <span>🧮</span>
                    <span className={css({ color: 'gray.700' })}>
                      <strong>Part 1:</strong> Use abacus
                    </span>
                  </div>
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                    <span>🧠</span>
                    <span className={css({ color: 'gray.700' })}>
                      <strong>Part 2:</strong> Mental math (visualization)
                    </span>
                  </div>
                  <div className={css({ display: 'flex', alignItems: 'center', gap: '0.5rem' })}>
                    <span>💭</span>
                    <span className={css({ color: 'gray.700' })}>
                      <strong>Part 3:</strong> Mental math (linear)
                    </span>
                  </div>
                </div>
              </div>

              {/* Error display for plan generation */}
              {error?.context === 'generate' && (
                <div
                  data-element="error-banner"
                  className={css({
                    padding: '1rem',
                    backgroundColor: 'red.50',
                    borderRadius: '8px',
                    border: '1px solid',
                    borderColor: 'red.200',
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

              {/* Action buttons */}
              <div
                className={css({
                  display: 'flex',
                  gap: '0.75rem',
                  marginTop: '1rem',
                })}
              >
                <button
                  type="button"
                  onClick={() => {
                    generatePlan.reset()
                    setViewState('dashboard')
                  }}
                  className={css({
                    flex: 1,
                    padding: '1rem',
                    fontSize: '1rem',
                    color: 'gray.600',
                    backgroundColor: 'gray.100',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    _hover: {
                      backgroundColor: 'gray.200',
                    },
                  })}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGeneratePlan}
                  disabled={generatePlan.isPending}
                  className={css({
                    flex: 2,
                    padding: '1rem',
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: 'white',
                    backgroundColor: generatePlan.isPending ? 'gray.400' : 'green.500',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: generatePlan.isPending ? 'not-allowed' : 'pointer',
                    _hover: {
                      backgroundColor: generatePlan.isPending ? 'gray.400' : 'green.600',
                    },
                  })}
                >
                  {generatePlan.isPending ? 'Generating...' : 'Generate Plan'}
                </button>
              </div>
            </div>
          )}

          {viewState === 'reviewing' && selectedStudent && currentPlan && (
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

          {viewState === 'practicing' && selectedStudent && currentPlan && (
            <ActiveSession
              plan={currentPlan}
              studentName={selectedStudent.name}
              onAnswer={handleAnswer}
              onEndEarly={handleEndEarly}
              onComplete={handleSessionComplete}
            />
          )}

          {viewState === 'summary' && selectedStudent && currentPlan && (
            <SessionSummary
              plan={currentPlan}
              studentName={selectedStudent.name}
              onPracticeAgain={handlePracticeAgain}
              onBackToDashboard={handleBackToDashboard}
            />
          )}

          {viewState === 'creating' && (
            <div
              data-section="create-student"
              className={css({
                textAlign: 'center',
                padding: '3rem',
              })}
            >
              <h2
                className={css({
                  fontSize: '1.5rem',
                  fontWeight: 'bold',
                  color: 'gray.800',
                  marginBottom: '1rem',
                })}
              >
                Add New Student
              </h2>
              <p
                className={css({
                  color: 'gray.600',
                  marginBottom: '2rem',
                })}
              >
                Student creation form coming soon!
              </p>
              <button
                type="button"
                onClick={() => setViewState('selecting')}
                className={css({
                  padding: '0.75rem 2rem',
                  fontSize: '1rem',
                  color: 'gray.700',
                  backgroundColor: 'gray.200',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  _hover: {
                    backgroundColor: 'gray.300',
                  },
                })}
              >
                ← Back to Student Selection
              </button>
            </div>
          )}

          {viewState === 'placement-test' && selectedStudent && (
            <PlacementTest
              studentName={selectedStudent.name}
              playerId={selectedStudent.id}
              onComplete={handlePlacementTestComplete}
              onCancel={handlePlacementTestCancel}
            />
          )}
        </div>

        {/* Manual Skill Selector Modal */}
        {selectedStudent && (
          <ManualSkillSelector
            studentName={selectedStudent.name}
            playerId={selectedStudent.id}
            open={showManualSkillModal}
            onClose={() => setShowManualSkillModal(false)}
            onSave={handleSaveManualSkills}
          />
        )}

        {/* Offline Session Form Modal */}
        {selectedStudent && (
          <OfflineSessionForm
            studentName={selectedStudent.name}
            playerId={selectedStudent.id}
            open={showOfflineSessionModal}
            onClose={() => setShowOfflineSessionModal(false)}
            onSubmit={handleSubmitOfflineSession}
          />
        )}
      </main>
    </PageWithNav>
  )
}
