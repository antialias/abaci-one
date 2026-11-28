import { eq } from 'drizzle-orm'
import { type NextRequest, NextResponse } from 'next/server'
import { db, schema } from '@/db'
import { generateFamilyCode, parentChild } from '@/db/schema'
import {
  DEFAULT_SESSION_PREFERENCES,
  playerSessionPreferences,
} from '@/db/schema/player-session-preferences'
import type { GameBreakSettings, GeneratedProblem } from '@/db/schema/session-plans'
import { subscriptions } from '@/db/schema/subscriptions'
import { PRACTICE_APPROVED_GAMES } from '@/lib/arcade/practice-approved-game-list'
import { withAuth } from '@/lib/auth/withAuth'
import {
  approveSessionPlan,
  generateSessionPlan,
  initializeStudent,
  startSessionPlan,
} from '@/lib/curriculum'
import { setPracticingSkills } from '@/lib/curriculum/progress-manager'
import { setPlanFields } from '@/lib/curriculum/row-cas'
import type { EnabledParts } from '@/lib/curriculum/session-planner'
import { getUserId } from '@/lib/viewer'

/**
 * A part a preset asks for, named by `(kind, presentation)` (practice-kinds
 * §4 K4). Generation still takes arithmetic's three toggles until the
 * planner registry plans any kind (K6a, which adds the one-kind starter), so
 * a preset names arithmetic's presentations only.
 */
interface PresetPart {
  kind: 'arithmetic'
  presentation: keyof EnabledParts
}

interface Preset {
  durationMinutes: number
  parts: readonly PresetPart[]
  overrideProblemsPerPart: number
  gameBreakSettings: GameBreakSettings
}

/**
 * Debug presets for quick session creation
 */
const PRESETS = {
  /** 2 parts (abacus + visualization), 1 problem each, auto-start matching game break */
  'game-break': {
    durationMinutes: 2,
    parts: [
      { kind: 'arithmetic', presentation: 'abacus' },
      { kind: 'arithmetic', presentation: 'visualization' },
    ],
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
    parts: [{ kind: 'arithmetic', presentation: 'abacus' }],
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
} as const satisfies Record<string, Preset>

type PresetName = keyof typeof PRESETS

/** The generator's toggles for a preset's parts: on for each presentation it names. */
function enabledPartsOf(parts: readonly PresetPart[]): EnabledParts {
  const enabled: EnabledParts = { abacus: false, visualization: false, linear: false }
  for (const part of parts) enabled[part.presentation] = true
  return enabled
}

/**
 * POST /api/debug/practice-session
 *
 * Creates a debug practice session atomically:
 * 1. Creates a debug player owned by the current viewer
 * 2. Initializes curriculum and enables basic skills
 * 3. Generates, approves, and starts a session with the specified preset
 * 4. Returns the player ID and redirect URL
 *
 * When `setupOnly: true`, skips session generation (steps 3-4) and returns
 * player info so the caller can open the StartPracticeModal instead.
 */
export const POST = withAuth(
  async (req: NextRequest) => {
    try {
      const body = await req.json()
      const preset = (body.preset as PresetName) || 'game-break'
      const setupOnly = body.setupOnly === true
      const simulateFamilyTier = body.simulateFamilyTier !== false // default true
      const overrideProblemTerms = body.overrideProblemTerms as number[] | undefined

      if (!(preset in PRESETS)) {
        return NextResponse.json(
          { error: `Unknown preset: ${preset}. Available: ${Object.keys(PRESETS).join(', ')}` },
          { status: 400 }
        )
      }

      const config = PRESETS[preset]
      const enabledParts = enabledPartsOf(config.parts)

      // 1. Get current viewer's database user ID
      const userId = await getUserId()

      // 2. Create debug player
      const [player] = await db
        .insert(schema.players)
        .values({
          userId,
          name: `Debug-${Date.now()}`,
          emoji: '🐛',
          color: '#ff6b6b',
          isActive: false,
          isExpungeable: true,
          familyCode: generateFamilyCode(),
        })
        .returning()

      // 2b. Create parent-child relationship (required for access control)
      await db.insert(parentChild).values({
        parentUserId: userId,
        childPlayerId: player.id,
      })

      // 2c. Ensure the user has a family subscription for debug testing
      if (simulateFamilyTier) {
        const existing = await db
          .select()
          .from(subscriptions)
          .where(eq(subscriptions.userId, userId))
          .limit(1)

        if (existing.length === 0) {
          await db.insert(subscriptions).values({
            userId,
            stripeCustomerId: `cus_debug_${Date.now()}`,
            stripeSubscriptionId: `sub_debug_${Date.now()}`,
            plan: 'family',
            status: 'active',
            currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          })
        } else if (existing[0].plan !== 'family' || existing[0].status !== 'active') {
          await db
            .update(subscriptions)
            .set({ plan: 'family', status: 'active' })
            .where(eq(subscriptions.userId, userId))
        }
      }

      // 3. Initialize curriculum
      await initializeStudent(player.id)

      // 4. Enable basic skills
      await setPracticingSkills(player.id, ['basic.+1', 'basic.+2', 'basic.+3'])

      // If setupOnly, save preset config as player session preferences
      // so the StartPracticeModal initializes with the preset's settings
      if (setupOnly) {
        await db.insert(playerSessionPreferences).values({
          playerId: player.id,
          config: JSON.stringify({
            ...DEFAULT_SESSION_PREFERENCES,
            durationMinutes: config.durationMinutes,
            partWeights: {
              abacus: enabledParts.abacus ? 1 : 0,
              visualization: enabledParts.visualization ? 1 : 0,
              linear: enabledParts.linear ? 1 : 0,
            },
            gameBreakEnabled: config.gameBreakSettings.enabled,
            gameBreakMinutes: config.gameBreakSettings.maxDurationMinutes,
            gameBreakSelectionMode: config.gameBreakSettings.selectionMode,
            gameBreakSelectedGame: config.gameBreakSettings.selectedGame,
            gameBreakEnabledGames: [...PRACTICE_APPROVED_GAMES],
          }),
          updatedAt: Date.now(),
        })

        return NextResponse.json({
          playerId: player.id,
          playerName: player.name,
          preset,
          setupOnly: true,
        })
      }

      // 5. Generate session with preset config
      const plan = await generateSessionPlan({
        playerId: player.id,
        durationMinutes: config.durationMinutes,
        enabledParts,
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
        await setPlanFields(plan.id, (current) => ({
          parts: current.parts.map((part, i) =>
            i === 0
              ? {
                  ...part,
                  slots: part.slots.map((slot, j) =>
                    j === 0 ? { ...slot, problem: customProblem } : slot
                  ),
                }
              : part
          ),
        }))
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
  },
  { role: 'admin' }
)
