import { NextResponse } from 'next/server'
import { PHI_EXPLORE_SUBJECTS } from '@/components/toys/number-line/constants/phiExploreData'
import { startPhiExploreGeneration } from '@/lib/tasks/phi-explore-generate'
import type { PhiExploreGenerateInput } from '@/lib/tasks/phi-explore-generate'
import { withAuth } from '@/lib/auth/withAuth'

const VALID_PROVIDERS = ['gemini', 'openai'] as const
const VALID_THEMES = ['light', 'dark'] as const

/**
 * POST /api/admin/constant-images/phi-explore/generate
 *
 * Starts a background task to generate phi explore subject illustrations.
 * Body: { provider, model, targets?, forceRegenerate?, theme?, pipeline? }
 *   pipeline: true → generates all subjects × [base, light, dark] in a single server-side task
 * Response: { taskId: string }
 */
export const POST = withAuth(
  async (request) => {
    try {
      const body = await request.json()
      const { provider, model, targets, forceRegenerate, theme, pipeline } = body

      // Validate provider
      if (!provider || !VALID_PROVIDERS.includes(provider)) {
        return NextResponse.json(
          { error: `provider must be one of: ${VALID_PROVIDERS.join(', ')}` },
          { status: 400 }
        )
      }

      // Validate model
      if (typeof model !== 'string' || model.trim().length === 0) {
        return NextResponse.json({ error: 'model must be a non-empty string' }, { status: 400 })
      }

      // Validate top-level theme
      if (theme !== undefined && !VALID_THEMES.includes(theme)) {
        return NextResponse.json(
          { error: `theme must be one of: ${VALID_THEMES.join(', ')}` },
          { status: 400 }
        )
      }

      // Build targets list
      let resolvedTargets: PhiExploreGenerateInput['targets']

      if (pipeline) {
        // Pipeline: all subjects × [base, light, dark] in order
        resolvedTargets = [
          ...PHI_EXPLORE_SUBJECTS.map((s) => ({ subjectId: s.id })),
          ...PHI_EXPLORE_SUBJECTS.map((s) => ({ subjectId: s.id, theme: 'light' as const })),
          ...PHI_EXPLORE_SUBJECTS.map((s) => ({ subjectId: s.id, theme: 'dark' as const })),
        ]
      } else if (targets && Array.isArray(targets) && targets.length > 0) {
        const subjectIds = new Set(PHI_EXPLORE_SUBJECTS.map((s) => s.id))
        for (const t of targets) {
          if (!subjectIds.has(t.subjectId)) {
            return NextResponse.json(
              { error: `Unknown subjectId: ${t.subjectId}` },
              { status: 400 }
            )
          }
          if (t.theme !== undefined && !VALID_THEMES.includes(t.theme)) {
            return NextResponse.json(
              { error: `target theme must be one of: ${VALID_THEMES.join(', ')}` },
              { status: 400 }
            )
          }
        }
        resolvedTargets = targets
      } else {
        // Default: all subjects (with optional top-level theme)
        resolvedTargets = PHI_EXPLORE_SUBJECTS.map((s) => ({
          subjectId: s.id,
          ...(theme && { theme: theme as 'light' | 'dark' }),
        }))
      }

      const taskId = await startPhiExploreGeneration({
        provider,
        model: model.trim(),
        targets: resolvedTargets,
        forceRegenerate: !!forceRegenerate,
      })

      return NextResponse.json({ taskId })
    } catch (error) {
      console.error('Error starting phi explore generation:', error)
      return NextResponse.json({ error: 'Failed to start phi explore generation' }, { status: 500 })
    }
  },
  { role: 'admin' }
)
