import { existsSync, statSync } from 'fs'
import { join } from 'path'
import { NextResponse } from 'next/server'
import {
  MATH_CONSTANTS,
  METAPHOR_PROMPT_PREFIX,
  MATH_PROMPT_PREFIX,
} from '@/components/toys/number-line/constants/constantsData'
import { IMAGE_PROVIDERS } from '@/lib/tasks/image-generate'

const IMAGES_DIR = join(process.cwd(), 'public', 'images', 'constants')

/**
 * GET /api/admin/constant-images/status
 *
 * Returns which constant images exist on disk and available providers.
 */
export async function GET() {
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

  return NextResponse.json({ constants, providers })
}
