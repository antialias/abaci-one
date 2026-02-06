import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { generateFamilyCode, parentChild } from '@/db/schema'
import type { GameBreakSettings, GeneratedProblem } from '@/db/schema/session-plans'
import {
  approveSessionPlan,
  generateSessionPlan,
  initializeStudent,
  startSessionPlan,
} from '@/lib/curriculum'
import { setPracticingSkills } from '@/lib/curriculum/progress-manager'
import { getDbUserId } from '@/lib/viewer'

/**
 * Debug presets for quick session creation
 */
const PRESETS = {
  /** 2 parts (abacus + visualization), 1 problem each, auto-start matching game break */
  'game-break': {
    durationMinutes: 2,
    enabledParts: { abacus: true, visualization: true, linear: false },
    overrideProblemsPerPart: 1,
    gameBreakSettings: {
      enabled: true,
      maxDurationMinutes: 2,
      selectionMode: 'auto-start' as const,
      selectedGame: 'matching',
      skipSetupPhase: true,
      useAdaptiveSelection: false,
    } satisfies GameBreakSettings,
  },
  /** 1 part (abacus only), 1 problem, no game break */
  minimal: {
    durationMinutes: 1,
    enabledParts: { abacus: true, visualization: false, linear: false },
    overrideProblemsPerPart: 1,
    gameBreakSettings: {
      enabled: false,
      maxDurationMinutes: 0,
      selectionMode: 'kid-chooses' as const,
      selectedGame: null,
      skipSetupPhase: true,
      useAdaptiveSelection: false,
    } satisfies GameBreakSettings,
  },
} as const

type PresetName = keyof typeof PRESETS

/**
 * POST /api/debug/practice-session
 *
 * Creates a debug practice session atomically:
 * 1. Creates a debug player owned by the current viewer
 * 2. Initializes curriculum and enables basic skills
 * 3. Generates, approves, and starts a session with the specified preset
 * 4. Returns the player ID and redirect URL
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const preset = (body.preset as PresetName) || 'game-break'
    const overrideProblemTerms = body.overrideProblemTerms as number[] | undefined

    if (!(preset in PRESETS)) {
      return NextResponse.json(
        { error: `Unknown preset: ${preset}. Available: ${Object.keys(PRESETS).join(', ')}` },
        { status: 400 }
      )
    }

    const config = PRESETS[preset]

    // 1. Get current viewer's database user ID
    const userId = await getDbUserId()

    // 2. Create debug player
    const [player] = await db
      .insert(schema.players)
      .values({
        userId,
        name: `Debug-${Date.now()}`,
        emoji: '🐛',
        color: '#ff6b6b',
        isActive: false,
        familyCode: generateFamilyCode(),
      })
      .returning()

    // 2b. Create parent-child relationship (required for access control)
    await db.insert(parentChild).values({
      parentUserId: userId,
      childPlayerId: player.id,
    })

    // 3. Initialize curriculum
    await initializeStudent(player.id)

    // 4. Enable basic skills
    await setPracticingSkills(player.id, ['basic.+1', 'basic.+2', 'basic.+3'])

    // 5. Generate session with preset config
    const plan = await generateSessionPlan({
      playerId: player.id,
      durationMinutes: config.durationMinutes,
      enabledParts: config.enabledParts,
      overrideProblemsPerPart: config.overrideProblemsPerPart,
      gameBreakSettings: config.gameBreakSettings,
    })

    // 5b. Override the first problem if custom terms were provided
    if (overrideProblemTerms && overrideProblemTerms.length > 0) {
      const customProblem: GeneratedProblem = {
        terms: overrideProblemTerms,
        answer: overrideProblemTerms.reduce((a, b) => a + b, 0),
        skillsRequired: [],
      }
      const updatedParts = plan.parts.map((part, i) =>
        i === 0
          ? {
              ...part,
              slots: part.slots.map((slot, j) =>
                j === 0 ? { ...slot, problem: customProblem } : slot
              ),
            }
          : part
      )
      await db
        .update(schema.sessionPlans)
        .set({ parts: updatedParts })
        .where(eq(schema.sessionPlans.id, plan.id))
    }

    // 6. Approve and start
    await approveSessionPlan(plan.id)
    await startSessionPlan(plan.id)

    // 7. Return redirect URL
    return NextResponse.json({
      playerId: player.id,
      sessionId: plan.id,
      preset,
      redirectUrl: `/practice/${player.id}?debug=1`,
    })
  } catch (error) {
    console.error('[debug/practice-session] Failed:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create debug session' },
      { status: 500 }
    )
  }
}
