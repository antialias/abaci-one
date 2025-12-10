'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { PageWithNav } from '@/components/PageWithNav'
import {
  type ActiveSessionState,
  type CurrentPhaseInfo,
  ProgressDashboard,
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
import type { SessionPlan } from '@/db/schema/session-plans'
import { css } from '../../../../../styled-system/css'

interface DashboardClientProps {
  studentId: string
  player: Player
  curriculum: PlayerCurriculum | null
  skills: PlayerSkillMastery[]
  recentSessions: PracticeSession[]
  activeSession: SessionPlan | null
  currentMasteredSkillIds: string[]
}

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

/**
 * Dashboard Client Component
 *
 * Shows the student's progress dashboard.
 * "Start Practice" navigates to /configure to set up a new session.
 * "Resume Practice" continues an existing active session.
 */

export function DashboardClient({
  studentId,
  player,
  curriculum,
  skills,
  recentSessions,
  activeSession,
  currentMasteredSkillIds,
}: DashboardClientProps) {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  // Modal states for onboarding features
  const [showManualSkillModal, setShowManualSkillModal] = useState(false)
  const [showOfflineSessionModal, setShowOfflineSessionModal] = useState(false)
  const [isStartingOver, setIsStartingOver] = useState(false)

  // Build ActiveSessionState for ProgressDashboard
  const activeSessionState: ActiveSessionState | null = activeSession
    ? (() => {
        const sessionSkillIds = activeSession.masteredSkillIds || []
        const sessionSet = new Set(sessionSkillIds)
        const currentSet = new Set(currentMasteredSkillIds)
        const skillsAdded = currentMasteredSkillIds.filter((id) => !sessionSet.has(id)).length
        const skillsRemoved = sessionSkillIds.filter((id) => !currentSet.has(id)).length

        return {
          id: activeSession.id,
          status: activeSession.status as 'draft' | 'approved' | 'in_progress',
          completedCount: activeSession.results.length,
          totalCount: activeSession.summary.totalProblemCount,
          hasSkillMismatch: skillsAdded > 0 || skillsRemoved > 0,
          skillsAdded,
          skillsRemoved,
        }
      })()
    : null

  // Build the student object
  const selectedStudent: StudentWithProgress = {
    id: player.id,
    name: player.name,
    emoji: player.emoji,
    color: player.color,
    createdAt: player.createdAt,
  }

  // Build current phase info from curriculum
  const currentPhase = curriculum
    ? getPhaseInfo(curriculum.currentPhaseId)
    : getPhaseInfo('L1.add.+1.direct')

  // Update phase info with actual skill mastery
  if (skills.length > 0) {
    const phaseSkills = skills.filter((s) => currentPhase.skillsToMaster.includes(s.skillId))
    currentPhase.masteredSkills = phaseSkills.filter((s) => s.masteryLevel === 'mastered').length
    currentPhase.totalSkills = currentPhase.skillsToMaster.length
  }

  // Map skills to display format
  const recentSkillsDisplay: SkillProgress[] = skills.slice(0, 5).map((s) => ({
    skillId: s.skillId,
    skillName: formatSkillName(s.skillId),
    masteryLevel: s.masteryLevel,
    attempts: s.attempts,
    correct: s.correct,
    consecutiveCorrect: s.consecutiveCorrect,
  }))

  // Handle start practice - navigate to configuration page
  const handleStartPractice = useCallback(() => {
    router.push(`/practice/${studentId}/configure`, { scroll: false })
  }, [studentId, router])

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
  const handleSaveManualSkills = useCallback(
    async (masteredSkillIds: string[]): Promise<void> => {
      const response = await fetch(`/api/curriculum/${studentId}/skills`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ masteredSkillIds }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save skills')
      }

      // Reload the page to show updated skills
      router.refresh()
      setShowManualSkillModal(false)
    },
    [studentId, router]
  )

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

  // Handle starting over (abandon current session and create new one)
  const handleStartOver = useCallback(async () => {
    if (!activeSession) return
    setIsStartingOver(true)
    try {
      // First abandon the old session
      await fetch(`/api/curriculum/${studentId}/sessions/plans/${activeSession.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'abandon' }),
      })
      // Navigate to configure to create a new one
      router.push(`/practice/${studentId}/configure`)
    } catch (error) {
      console.error('Failed to start over:', error)
      setIsStartingOver(false)
    }
  }, [activeSession, studentId, router])

  // Handle resuming the current session
  const handleResumeSession = useCallback(() => {
    router.push(`/practice/${studentId}/session`)
  }, [studentId, router])

  return (
    <PageWithNav>
      <main
        data-component="practice-dashboard-page"
        className={css({
          minHeight: '100vh',
          backgroundColor: isDark ? 'gray.900' : 'gray.50',
          paddingTop: 'calc(80px + 2rem)',
          paddingLeft: '2rem',
          paddingRight: '2rem',
          paddingBottom: '2rem',
        })}
      >
        <div
          className={css({
            maxWidth: '800px',
            margin: '0 auto',
          })}
        >
          {/* Header */}
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

          {/* Progress Dashboard - unified session-aware component */}
          <ProgressDashboard
            student={selectedStudent}
            currentPhase={currentPhase}
            recentSkills={recentSkillsDisplay}
            activeSession={activeSessionState}
            onStartPractice={handleStartPractice}
            onResumePractice={handleResumeSession}
            onStartOver={handleStartOver}
            isStartingOver={isStartingOver}
            onViewFullProgress={handleViewFullProgress}
            onGenerateWorksheet={handleGenerateWorksheet}
            onRunPlacementTest={handleRunPlacementTest}
            onSetSkillsManually={handleSetSkillsManually}
            onRecordOfflinePractice={handleRecordOfflinePractice}
          />
        </div>

        {/* Manual Skill Selector Modal */}
        <ManualSkillSelector
          studentName={selectedStudent.name}
          playerId={selectedStudent.id}
          open={showManualSkillModal}
          onClose={() => setShowManualSkillModal(false)}
          onSave={handleSaveManualSkills}
          currentMasteredSkills={skills
            .filter((s) => s.masteryLevel === 'mastered')
            .map((s) => s.skillId)}
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
