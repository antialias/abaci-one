import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/withAuth'
import {
  MATH_CONSTANTS,
  METAPHOR_PROMPT_PREFIX,
  MATH_PROMPT_PREFIX,
} from '@/components/toys/number-line/constants/constantsData'
import {
  PHI_EXPLORE_SUBJECTS,
  PHI_EXPLORE_PROMPT_PREFIX,
} from '@/components/toys/number-line/constants/phiExploreData'
import { IMAGE_PROVIDERS } from '@/lib/tasks/image-generate'

const IMAGES_DIR = join(process.cwd(), 'public', 'images', 'constants')
const PHI_EXPLORE_DIR = join(IMAGES_DIR, 'phi-explore')

/**
 * GET /api/admin/constant-images/status
 *
 * Returns which constant images exist on disk and available providers.
 */
export const GET = withAuth(async () => {
  const constants = MATH_CONSTANTS.map((c) => {
    const metaphorFile = join(IMAGES_DIR, `${c.id}-metaphor.png`)
    const mathFile = join(IMAGES_DIR, `${c.id}-math.png`)

    const metaphorExists = existsSync(metaphorFile)
    const mathExists = existsSync(mathFile)

    const metaphorLightExists = existsSync(join(IMAGES_DIR, `${c.id}-metaphor-light.png`))
    const metaphorDarkExists = existsSync(join(IMAGES_DIR, `${c.id}-metaphor-dark.png`))
    const mathLightExists = existsSync(join(IMAGES_DIR, `${c.id}-math-light.png`))
    const mathDarkExists = existsSync(join(IMAGES_DIR, `${c.id}-math-dark.png`))

    return {
      id: c.id,
      name: c.name,
      symbol: c.symbol,
      metaphor: {
        exists: metaphorExists,
        sizeBytes: metaphorExists ? statSync(metaphorFile).size : undefined,
        prompt: `${METAPHOR_PROMPT_PREFIX} ${c.metaphorPrompt}`,
        lightExists: metaphorLightExists,
        darkExists: metaphorDarkExists,
      },
      math: {
        exists: mathExists,
        sizeBytes: mathExists ? statSync(mathFile).size : undefined,
        prompt: `${MATH_PROMPT_PREFIX} ${c.mathPrompt}`,
        lightExists: mathLightExists,
        darkExists: mathDarkExists,
      },
    }
  })

  const providers = IMAGE_PROVIDERS.map((p) => {
    const hasKey =
      'envKeyAlt' in p
        ? !!(process.env[p.envKey] || process.env[p.envKeyAlt!])
        : !!process.env[p.envKey]

    return {
      id: p.id,
      name: p.name,
      available: hasKey,
      models: p.models.map((m) => ({ id: m.id, name: m.name })),
    }
  })

  const phiExplore = PHI_EXPLORE_SUBJECTS.map((s) => {
    const baseFile = join(PHI_EXPLORE_DIR, `${s.id}.png`)
    const baseExists = existsSync(baseFile)
    return {
      id: s.id,
      name: s.name,
      prompt: `${PHI_EXPLORE_PROMPT_PREFIX} ${s.prompt}`,
      exists: baseExists,
      sizeBytes: baseExists ? statSync(baseFile).size : undefined,
      lightExists: existsSync(join(PHI_EXPLORE_DIR, `${s.id}-light.png`)),
      darkExists: existsSync(join(PHI_EXPLORE_DIR, `${s.id}-dark.png`)),
    }
  })

  return NextResponse.json({ constants, providers, phiExplore })
}, { role: 'admin' })
