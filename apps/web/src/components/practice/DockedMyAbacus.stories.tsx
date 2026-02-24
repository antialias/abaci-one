'use client'

import { AbacusStatic } from '@soroban/abacus-react'
import type { Meta, StoryObj } from '@storybook/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MyAbacusProvider, useMyAbacus } from '@/contexts/MyAbacusContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import type {
  GeneratedProblem,
  ProblemSlot,
  SessionHealth,
  SessionPart,
  SessionPlan,
  SessionSummary,
  SlotResult,
} from '@/db/schema/session-plans'
import { createBasicSkillSet } from '@/types/tutorial'
import {
  analyzeRequiredSkills,
  type ProblemConstraints as GeneratorConstraints,
  generateSingleProblem,
} from '@/utils/problemGenerator'
import { css } from '../../../styled-system/css'
import { MyAbacus } from '../MyAbacus'
import { ActiveSession, type StudentInfo } from './ActiveSession'

/**
 * Stories showing the actual MyAbacus docked into practice sessions.
 * These use the real ActiveSession and MyAbacus components to replicate
 * the actual user experience for debugging layout issues.
 */
const meta: Meta = {
  title: 'Practice/MyAbacus Docked on Practice',
  parameters: {
    layout: 'fullscreen',
  },
}

export default meta
type Story = StoryObj

// ============================================================================
// HELPERS - Same as ActiveSession.stories.tsx
// ============================================================================

function createMockStudent(name: string): StudentInfo {
  const students: Record<string, StudentInfo> = {
    Sonia: { id: 'student-sonia', name: 'Sonia', emoji: '🌟', color: 'purple' },
    Marcus: {
      id: 'student-marcus',
      name: 'Marcus',
      emoji: '🚀',
      color: 'blue',
    },
    Luna: { id: 'student-luna', name: 'Luna', emoji: '🌙', color: 'indigo' },
  }
  return (
    students[name] ?? {
      id: `student-${name.toLowerCase()}`,
      name,
      emoji: '🎓',
      color: 'gray',
    }
  )
}

function generateProblemWithSkills(
  skillLevel: 'basic' | 'fiveComplements' | 'tenComplements'
): GeneratedProblem {
  const baseSkills = createBasicSkillSet()
  baseSkills.basic.directAddition = true
  baseSkills.basic.heavenBead = true
  baseSkills.basic.simpleCombinations = true

  if (skillLevel === 'fiveComplements' || skillLevel === 'tenComplements') {
    baseSkills.fiveComplements['4=5-1'] = true
    baseSkills.fiveComplements['3=5-2'] = true
  }

  if (skillLevel === 'tenComplements') {
    baseSkills.tenComplements['9=10-1'] = true
    baseSkills.tenComplements['8=10-2'] = true
  }

  const constraints: GeneratorConstraints = {
    numberRange: { min: 1, max: skillLevel === 'tenComplements' ? 99 : 9 },
    maxTerms: 4,
    problemCount: 1,
  }

  const problem = generateSingleProblem(constraints, baseSkills)
  if (problem) {
    return {
      terms: problem.terms,
      answer: problem.answer,
      skillsRequired: problem.skillsUsed,
    }
  }

  const terms = [3, 4, 2]
  return {
    terms,
    answer: terms.reduce((a, b) => a + b, 0),
    skillsRequired: analyzeRequiredSkills(terms, 9),
  }
}

function createMockSlotsWithProblems(
  count: number,
  skillLevel: 'basic' | 'fiveComplements' | 'tenComplements',
  purposes: Array<'focus' | 'reinforce' | 'review' | 'challenge'> = ['focus', 'reinforce', 'review']
): ProblemSlot[] {
  return Array.from({ length: count }, (_, i) => {
    const allowedSkills: ProblemSlot['constraints']['allowedSkills'] = {
      basic: { directAddition: true, heavenBead: true },
      ...(skillLevel !== 'basic' && {
        fiveComplements: { '4=5-1': true, '3=5-2': true },
      }),
      ...(skillLevel === 'tenComplements' && {
        tenComplements: { '9=10-1': true, '8=10-2': true },
      }),
    } as ProblemSlot['constraints']['allowedSkills']

    return {
      index: i,
      purpose: purposes[i % purposes.length],
      constraints: {
        allowedSkills,
        digitRange: { min: 1, max: skillLevel === 'tenComplements' ? 2 : 1 },
        termCount: { min: 3, max: 4 },
      },
      problem: generateProblemWithSkills(skillLevel),
    }
  })
}

function createMockSessionPlan(config: {
  totalProblems?: number
  skillLevel?: 'basic' | 'fiveComplements' | 'tenComplements'
  currentPartIndex?: number
  currentSlotIndex?: number
  sessionHealth?: SessionHealth | null
}): SessionPlan {
  const totalProblems = config.totalProblems || 15
  const skillLevel = config.skillLevel || 'basic'

  const part1Count = Math.round(totalProblems * 0.5)
  const part2Count = Math.round(totalProblems * 0.3)
  const part3Count = totalProblems - part1Count - part2Count

  const parts: SessionPart[] = [
    {
      partNumber: 1,
      type: 'abacus',
      format: 'vertical',
      useAbacus: true,
      slots: createMockSlotsWithProblems(part1Count, skillLevel, ['focus', 'focus', 'reinforce']),
      estimatedMinutes: 5,
    },
    {
      partNumber: 2,
      type: 'visualization',
      format: 'vertical',
      useAbacus: false,
      slots: createMockSlotsWithProblems(part2Count, skillLevel, ['focus', 'reinforce', 'review']),
      estimatedMinutes: 3,
    },
    {
      partNumber: 3,
      type: 'linear',
      format: 'linear',
      useAbacus: false,
      slots: createMockSlotsWithProblems(part3Count, skillLevel, ['review', 'challenge']),
      estimatedMinutes: 2,
    },
  ]

  const summary: SessionSummary = {
    focusDescription:
      skillLevel === 'tenComplements'
        ? 'Ten Complements'
        : skillLevel === 'fiveComplements'
          ? 'Five Complements'
          : 'Basic Addition',
    totalProblemCount: totalProblems,
    estimatedMinutes: 10,
    parts: parts.map((p) => ({
      partNumber: p.partNumber,
      type: p.type,
      description:
        p.type === 'abacus'
          ? 'Use Abacus'
          : p.type === 'visualization'
            ? 'Mental Math (Visualization)'
            : 'Mental Math (Linear)',
      problemCount: p.slots.length,
      estimatedMinutes: p.estimatedMinutes,
    })),
  }

  return {
    id: 'plan-active-123',
    playerId: 'player-1',
    targetDurationMinutes: 10,
    estimatedProblemCount: totalProblems,
    avgTimePerProblemSeconds: 40,
    gameBreakSettings: {
      enabled: false,
      maxDurationMinutes: 5,
      selectionMode: 'kid-chooses',
      selectedGame: null,
    },
    parts,
    summary,
    masteredSkillIds: ['basic.+1', 'basic.+2', 'basic.+3'],
    status: 'in_progress',
    flowState: 'practicing',
    flowUpdatedAt: new Date(),
    flowVersion: 0,
    currentPartIndex: config.currentPartIndex ?? 0,
    currentSlotIndex: config.currentSlotIndex ?? 0,
    breakStartedAt: null,
    breakReason: null,
    breakSelectedGame: null,
    breakResults: null,
    sessionHealth: config.sessionHealth ?? null,
    adjustments: [],
    results: [],
    createdAt: new Date(),
    approvedAt: new Date(Date.now() - 60000),
    startedAt: new Date(Date.now() - 30000),
    completedAt: null,
    isPaused: false,
    pausedAt: null,
    pausedBy: null,
    pauseReason: null,
    retryState: null,
    remoteCameraSessionId: null,
  }
}

const defaultHandlers = {
  onAnswer: async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>) => {
    console.log('Answer recorded:', result)
  },
  onEndEarly: (reason?: string) => {
    console.log(`Session ended early: ${reason || 'No reason given'}`)
  },
  onPause: () => console.log('Session paused'),
  onResume: () => console.log('Session resumed'),
  onComplete: () => console.log('Session completed!'),
}

// ============================================================================
// AUTO-DOCK WRAPPER
// ============================================================================

/**
 * Component that auto-docks the MyAbacus into the AbacusDock when it becomes visible.
 * This simulates the user clicking to dock the abacus.
 */
function AutoDockTrigger() {
  const { dock, isDockedByUser, dockInto } = useMyAbacus()

  useEffect(() => {
    // Auto-dock when dock becomes visible and we're not already docked
    if (dock?.isVisible && !isDockedByUser) {
      // Small delay to let the dock register properly
      const timer = setTimeout(() => {
        dockInto()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [dock?.isVisible, isDockedByUser, dockInto])

  return null
}

/**
 * Provider wrapper that includes all necessary context for the docked abacus.
 */
function StoryProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <MyAbacusProvider>
        <AutoDockTrigger />
        {children}
        {/* The actual MyAbacus component that renders into the dock */}
        <MyAbacus />
      </MyAbacusProvider>
    </ThemeProvider>
  )
}

/**
 * Wrapper for consistent page styling
 */
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={css({
        backgroundColor: 'gray.100',
        minHeight: '100vh',
        padding: '1rem',
      })}
    >
      {children}
    </div>
  )
}

// ============================================================================
// STORIES WITH REAL COMPONENTS
// ============================================================================

/**
 * Real ActiveSession with docked MyAbacus - Part 1 (Abacus mode)
 *
 * This is the actual practice session page with the MyAbacus docked.
 * The abacus should auto-dock when the story renders.
 */
export const Part1AbacusWithDockedAbacus: Story = {
  render: () => (
    <StoryProviders>
      <PageWrapper>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'basic',
            currentPartIndex: 0,
            currentSlotIndex: 0,
          })}
          student={createMockStudent('Sonia')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </StoryProviders>
  ),
}

/**
 * Real ActiveSession - Part 2 (Visualization mode, no abacus dock)
 *
 * Part 2 doesn't show the abacus dock, so MyAbacus should remain
 * as a floating button.
 */
export const Part2VisualizationNoDock: Story = {
  render: () => (
    <StoryProviders>
      <PageWrapper>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'fiveComplements',
            currentPartIndex: 1,
            currentSlotIndex: 0,
          })}
          student={createMockStudent('Marcus')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </StoryProviders>
  ),
}

/**
 * Real ActiveSession with larger numbers (requires more columns)
 */
export const LargerNumbersWithDock: Story = {
  render: () => (
    <StoryProviders>
      <PageWrapper>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'tenComplements',
            currentPartIndex: 0,
            currentSlotIndex: 0,
          })}
          student={createMockStudent('Luna')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </StoryProviders>
  ),
}

/**
 * Mid-session with health indicators
 */
export const MidSessionWithHealth: Story = {
  render: () => (
    <StoryProviders>
      <PageWrapper>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'basic',
            currentPartIndex: 0,
            currentSlotIndex: 4,
            sessionHealth: {
              overall: 'good',
              accuracy: 0.85,
              pacePercent: 110,
              currentStreak: 4,
              avgResponseTimeMs: 3500,
            },
          })}
          student={createMockStudent('Sonia')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </StoryProviders>
  ),
}

/**
 * Session showing struggling state
 */
export const StrugglingSession: Story = {
  render: () => (
    <StoryProviders>
      <PageWrapper>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'tenComplements',
            currentPartIndex: 0,
            currentSlotIndex: 5,
            sessionHealth: {
              overall: 'struggling',
              accuracy: 0.45,
              pacePercent: 65,
              currentStreak: -3,
              avgResponseTimeMs: 8500,
            },
          })}
          student={createMockStudent('Luna')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </StoryProviders>
  ),
}

// ============================================================================
// INTERACTIVE DEMO
// ============================================================================

/**
 * Interactive demo where you can answer problems and see the abacus update
 */
function InteractiveDemo() {
  const [plan, setPlan] = useState(() =>
    createMockSessionPlan({
      totalProblems: 6,
      skillLevel: 'basic',
      sessionHealth: {
        overall: 'good',
        accuracy: 1,
        pacePercent: 100,
        currentStreak: 0,
        avgResponseTimeMs: 0,
      },
    })
  )
  const [results, setResults] = useState<SlotResult[]>([])

  const handleAnswer = useCallback(
    async (result: Omit<SlotResult, 'timestamp' | 'partNumber'>) => {
      const fullResult: SlotResult = {
        ...result,
        partNumber: (plan.currentPartIndex + 1) as 1 | 2 | 3,
        timestamp: new Date(),
        hadHelp: result.hadHelp ?? false,
        incorrectAttempts: result.incorrectAttempts ?? 0,
        helpTrigger: result.helpTrigger ?? 'none',
      }
      setResults((prev) => [...prev, fullResult])

      setPlan((prev) => {
        const currentPart = prev.parts[prev.currentPartIndex]
        const nextSlotIndex = prev.currentSlotIndex + 1

        if (nextSlotIndex >= currentPart.slots.length) {
          return {
            ...prev,
            currentPartIndex: prev.currentPartIndex + 1,
            currentSlotIndex: 0,
          }
        }

        return {
          ...prev,
          currentSlotIndex: nextSlotIndex,
        }
      })
    },
    [plan.currentPartIndex]
  )

  const handleComplete = useCallback(() => {
    alert(
      `Session complete! Results: ${results.filter((r) => r.isCorrect).length}/${results.length} correct`
    )
  }, [results])

  return (
    <StoryProviders>
      <PageWrapper>
        <ActiveSession
          plan={plan}
          student={createMockStudent('Sonia')}
          onAnswer={handleAnswer}
          onEndEarly={(reason) => console.log(`Ended: ${reason}`)}
          onComplete={handleComplete}
        />
      </PageWrapper>
    </StoryProviders>
  )
}

export const Interactive: Story = {
  render: () => <InteractiveDemo />,
}

// ============================================================================
// COMPARISON: WITH AND WITHOUT DOCK
// ============================================================================

/**
 * Side-by-side comparison: Part 1 (with dock) vs Part 2 (without dock)
 *
 * Shows how the layout differs between abacus mode and visualization mode.
 */
function ComparisonDemo() {
  const [activeTab, setActiveTab] = useState<'part1' | 'part2'>('part1')

  return (
    <StoryProviders>
      <div className={css({ minHeight: '100vh', bg: 'gray.50' })}>
        {/* Tab selector */}
        <div
          className={css({
            display: 'flex',
            gap: '0.5rem',
            p: '1rem',
            bg: 'white',
            borderBottom: '1px solid',
            borderColor: 'gray.200',
          })}
        >
          <button
            type="button"
            onClick={() => setActiveTab('part1')}
            className={css({
              px: '1rem',
              py: '0.5rem',
              borderRadius: 'md',
              border: 'none',
              bg: activeTab === 'part1' ? 'blue.500' : 'gray.200',
              color: activeTab === 'part1' ? 'white' : 'gray.700',
              fontWeight: '500',
              cursor: 'pointer',
            })}
          >
            Part 1: Abacus Mode (with dock)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('part2')}
            className={css({
              px: '1rem',
              py: '0.5rem',
              borderRadius: 'md',
              border: 'none',
              bg: activeTab === 'part2' ? 'blue.500' : 'gray.200',
              color: activeTab === 'part2' ? 'white' : 'gray.700',
              fontWeight: '500',
              cursor: 'pointer',
            })}
          >
            Part 2: Visualization Mode (no dock)
          </button>
        </div>

        {/* Content */}
        <PageWrapper>
          {activeTab === 'part1' ? (
            <ActiveSession
              plan={createMockSessionPlan({
                skillLevel: 'basic',
                currentPartIndex: 0,
                currentSlotIndex: 0,
              })}
              student={createMockStudent('Sonia')}
              {...defaultHandlers}
            />
          ) : (
            <ActiveSession
              plan={createMockSessionPlan({
                skillLevel: 'fiveComplements',
                currentPartIndex: 1,
                currentSlotIndex: 0,
              })}
              student={createMockStudent('Marcus')}
              {...defaultHandlers}
            />
          )}
        </PageWrapper>
      </div>
    </StoryProviders>
  )
}

export const Comparison: Story = {
  render: () => <ComparisonDemo />,
}

// ============================================================================
// VISION MODE STORIES - Using Real Components
// ============================================================================

/**
 * Creates a proper CalibrationGrid structure for storybook testing
 */
function createFakeCalibrationGrid(columns: number) {
  const width = 320
  const height = 400
  return {
    roi: { x: 0, y: 0, width, height },
    corners: {
      topLeft: { x: 0, y: 0 },
      topRight: { x: width, y: 0 },
      bottomLeft: { x: 0, y: height },
      bottomRight: { x: width, y: height },
    },
    columnCount: columns,
    columnDividers: Array.from({ length: columns - 1 }, (_, i) => (i + 1) / columns),
    rotation: 0,
  }
}

/**
 * Sets up localStorage with vision config before the provider mounts.
 * This makes the real MyAbacus render DockedVisionFeed.
 *
 * IMPORTANT: We set localStorage synchronously during render (via useRef)
 * so that MyAbacusProvider sees the config when it mounts.
 */
function VisionConfigSetup({
  children,
  cameraSource = 'local',
  columnCount = 2,
}: {
  children: React.ReactNode
  cameraSource?: 'local' | 'phone'
  columnCount?: number
}) {
  // Track if we've set up config this render cycle
  const setupDoneRef = useRef(false)

  // Build config - only set remoteCameraSessionId for phone source
  // to avoid triggering socket connection attempts for local camera stories
  const buildConfig = useCallback(
    () => ({
      enabled: true,
      cameraDeviceId: cameraSource === 'local' ? 'fake-storybook-camera' : null,
      calibration: createFakeCalibrationGrid(columnCount),
      // Only set remote session for phone source - prevents socket errors in local camera stories
      remoteCameraSessionId: cameraSource === 'phone' ? 'fake-storybook-session' : null,
      activeCameraSource: cameraSource,
    }),
    [cameraSource, columnCount]
  )

  // Set up localStorage SYNCHRONOUSLY before children render
  // This ensures MyAbacusProvider sees the config when it mounts
  if (!setupDoneRef.current) {
    localStorage.setItem('abacus-vision-config', JSON.stringify(buildConfig()))
    setupDoneRef.current = true
  }

  // Clean up on unmount
  useEffect(() => {
    return () => {
      localStorage.removeItem('abacus-vision-config')
      setupDoneRef.current = false
    }
  }, [])

  // Re-apply config if props change
  useEffect(() => {
    localStorage.setItem('abacus-vision-config', JSON.stringify(buildConfig()))
  }, [buildConfig])

  return <>{children}</>
}

/**
 * Provider wrapper for vision-enabled stories.
 * Pre-configures vision so DockedVisionFeed renders.
 */
function VisionStoryProviders({
  children,
  cameraSource = 'local',
  columnCount = 2,
}: {
  children: React.ReactNode
  cameraSource?: 'local' | 'phone'
  columnCount?: number
}) {
  return (
    <VisionConfigSetup cameraSource={cameraSource} columnCount={columnCount}>
      <ThemeProvider>
        <MyAbacusProvider>
          <AutoDockTrigger />
          {children}
          <MyAbacus />
        </MyAbacusProvider>
      </ThemeProvider>
    </VisionConfigSetup>
  )
}

/**
 * Vision mode with real components - Local camera
 *
 * Uses real ActiveSession + MyAbacus + DockedVisionFeed.
 * Will show loading/error state since there's no real camera,
 * but uses the actual component layout for debugging.
 */
export const VisionLocalCamera: Story = {
  render: () => (
    <VisionStoryProviders cameraSource="local">
      <PageWrapper>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'basic',
            currentPartIndex: 0,
            currentSlotIndex: 0,
          })}
          student={createMockStudent('Vision Test')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </VisionStoryProviders>
  ),
}

/**
 * Vision mode with real components - Phone camera
 *
 * Uses real ActiveSession + MyAbacus + DockedVisionFeed.
 * Will show "Connecting to phone..." since there's no real session.
 */
export const VisionPhoneCamera: Story = {
  render: () => (
    <VisionStoryProviders cameraSource="phone">
      <PageWrapper>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'basic',
            currentPartIndex: 0,
            currentSlotIndex: 0,
          })}
          student={createMockStudent('Vision Test')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </VisionStoryProviders>
  ),
}

/**
 * Vision mode - Larger numbers requiring more columns
 */
export const VisionLargerNumbers: Story = {
  render: () => (
    <VisionStoryProviders cameraSource="local">
      <PageWrapper>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'tenComplements',
            currentPartIndex: 0,
            currentSlotIndex: 0,
          })}
          student={createMockStudent('Vision Test')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </VisionStoryProviders>
  ),
}

// ============================================================================
// VISION MIRROR MODE - With Fake Video Stream from AbacusStatic
// ============================================================================

/**
 * Creates a factory function that generates fake MediaStreams from AbacusStatic.
 * Returns a new stream each time getUserMedia is called (important because
 * streams can be stopped by the vision components when switching camera sources).
 */
function useAbacusStreamFactory(
  value: number,
  columns: number
): (() => Promise<MediaStream>) | null {
  const [ready, setReady] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const animationRef = useRef<number | null>(null)
  const activeStreamsRef = useRef<MediaStream[]>([])

  useEffect(() => {
    // Create off-screen canvas
    const canvas = document.createElement('canvas')
    canvas.width = 320
    canvas.height = 400
    canvasRef.current = canvas
    const ctx = canvas.getContext('2d')!

    // Render AbacusStatic to SVG string
    const svgString = renderToStaticMarkup(
      <AbacusStatic
        value={value}
        columns={columns}
        scaleFactor={1}
        colorScheme="place-value"
        showNumbers={true}
      />
    )

    // Create Image from SVG blob
    const blob = new Blob([svgString], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      imgRef.current = img

      // Fill with dark background (like a camera view)
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw abacus centered
      const scale = Math.min(canvas.width / img.width, canvas.height / img.height) * 0.9
      const x = (canvas.width - img.width * scale) / 2
      const y = (canvas.height - img.height * scale) / 2
      ctx.drawImage(img, x, y, img.width * scale, img.height * scale)

      // Keep drawing to maintain streams (some browsers need this)
      const drawLoop = () => {
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale)
        animationRef.current = requestAnimationFrame(drawLoop)
      }
      drawLoop()

      setReady(true)
    }

    img.src = url

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      // Stop all streams we created
      activeStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()))
      activeStreamsRef.current = []
    }
  }, [value, columns])

  // Return a factory function that creates new streams on demand
  const createStream = useCallback(async (): Promise<MediaStream> => {
    if (!canvasRef.current) {
      throw new Error('Canvas not ready')
    }
    // Create a fresh MediaStream from the canvas
    const newStream = canvasRef.current.captureStream(30)
    activeStreamsRef.current.push(newStream)
    console.log('[Storybook] Created new fake AbacusStatic video stream')
    return newStream
  }, [])

  return ready ? createStream : null
}

/**
 * Component that mocks navigator.mediaDevices.getUserMedia
 * to return a fake stream from AbacusStatic rendering.
 *
 * Creates a NEW stream each time getUserMedia is called, so switching
 * between camera sources (phone/local) works correctly.
 */
function FakeVisionCameraSetup({
  children,
  abacusValue,
  abacusColumns,
}: {
  children: React.ReactNode
  abacusValue: number
  abacusColumns: number
}) {
  const createStream = useAbacusStreamFactory(abacusValue, abacusColumns)
  const [ready, setReady] = useState(false)
  const originalGetUserMediaRef = useRef<typeof navigator.mediaDevices.getUserMedia | null>(null)

  useEffect(() => {
    if (!createStream) return

    // Save original and mock getUserMedia
    originalGetUserMediaRef.current = navigator.mediaDevices.getUserMedia.bind(
      navigator.mediaDevices
    )

    // Mock returns a NEW stream each time (important for tab switching)
    navigator.mediaDevices.getUserMedia = async () => {
      return createStream()
    }

    setReady(true)

    return () => {
      // Restore original
      if (originalGetUserMediaRef.current) {
        navigator.mediaDevices.getUserMedia = originalGetUserMediaRef.current
      }
    }
  }, [createStream])

  if (!ready) {
    return (
      <div
        className={css({
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          bg: 'gray.100',
          color: 'gray.600',
        })}
      >
        Setting up fake camera...
      </div>
    )
  }

  return <>{children}</>
}

/**
 * Provider wrapper for vision mirror mode stories.
 * Includes fake camera setup that returns AbacusStatic as video.
 */
function VisionMirrorProviders({
  children,
  abacusValue,
  abacusColumns,
}: {
  children: React.ReactNode
  abacusValue: number
  abacusColumns: number
}) {
  return (
    <FakeVisionCameraSetup abacusValue={abacusValue} abacusColumns={abacusColumns}>
      <VisionConfigSetup cameraSource="local" columnCount={abacusColumns}>
        <ThemeProvider>
          <MyAbacusProvider>
            <AutoDockTrigger />
            {children}
            <MyAbacus />
          </MyAbacusProvider>
        </ThemeProvider>
      </VisionConfigSetup>
    </FakeVisionCameraSetup>
  )
}

/**
 * Vision Mirror Mode Demo
 *
 * This story injects a fake video stream that shows AbacusStatic,
 * simulating what a camera would see looking at a physical abacus.
 *
 * The real DockedVisionFeed component receives this fake stream and
 * should display it. When the ML classifier detects values, the
 * toggle button becomes available to switch to mirror mode with PIP.
 *
 * Note: Since the ML model may not work on synthetic renders,
 * you may need to manually verify the layout in the real app.
 */
function VisionMirrorDemo() {
  const [abacusValue] = useState(45)
  const [abacusColumns] = useState(2)

  return (
    <VisionMirrorProviders abacusValue={abacusValue} abacusColumns={abacusColumns}>
      <PageWrapper>
        <div className={css({ mb: 4, p: 3, bg: 'blue.50', borderRadius: 'lg' })}>
          <p className={css({ fontSize: 'sm', color: 'blue.700' })}>
            <strong>Vision Mirror Test:</strong> The dock should show a fake video feed rendering
            AbacusStatic (value: {abacusValue}). If ML detection works on this synthetic feed, click
            the 🧮 toggle to enter mirror mode with PIP.
          </p>
        </div>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'basic',
            currentPartIndex: 0,
            currentSlotIndex: 0,
          })}
          student={createMockStudent('Mirror Test')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </VisionMirrorProviders>
  )
}

export const VisionMirrorWithFakeCamera: Story = {
  render: () => <VisionMirrorDemo />,
}

/**
 * Vision Mirror Mode with larger numbers (3 columns)
 */
function VisionMirrorLargeDemo() {
  const [abacusValue] = useState(247)
  const [abacusColumns] = useState(3)

  return (
    <VisionMirrorProviders abacusValue={abacusValue} abacusColumns={abacusColumns}>
      <PageWrapper>
        <div className={css({ mb: 4, p: 3, bg: 'blue.50', borderRadius: 'lg' })}>
          <p className={css({ fontSize: 'sm', color: 'blue.700' })}>
            <strong>Vision Mirror Test (Large):</strong> Fake video showing AbacusStatic with value{' '}
            {abacusValue} ({abacusColumns} columns).
          </p>
        </div>
        <ActiveSession
          plan={createMockSessionPlan({
            skillLevel: 'tenComplements',
            currentPartIndex: 0,
            currentSlotIndex: 0,
          })}
          student={createMockStudent('Large Mirror Test')}
          {...defaultHandlers}
        />
      </PageWrapper>
    </VisionMirrorProviders>
  )
}

export const VisionMirrorLargeNumbers: Story = {
  render: () => <VisionMirrorLargeDemo />,
}
