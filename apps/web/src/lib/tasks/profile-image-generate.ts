/**
 * Background task for generating character profile images.
 *
 * Supports a 3×3×2 matrix of size × theme × state variants:
 *   - Sizes: default, sm (14-24px avatars), lg (120px+ hero)
 *   - Themes: default, light, dark
 *   - States: idle (resting), speaking (mouth open, animated expression)
 *
 * Each variant can use a reference image for image-to-image generation.
 * The `cascade` flag controls whether a task fires dependent tasks on completion:
 *   base(idle) → light(idle), dark(idle), sm(idle), lg(idle), base(speaking)
 *   sm(idle)   → sm-light(idle), sm-dark(idle), sm(speaking)
 *   lg(idle)   → lg-light(idle), lg-dark(idle), lg(speaking)
 *   light(idle) → light(speaking)
 *   dark(idle)  → dark(speaking)
 *   sm-light(idle) → sm-light(speaking)
 *   sm-dark(idle)  → sm-dark(speaking)
 *   lg-light(idle) → lg-light(speaking)
 *   lg-dark(idle)  → lg-dark(speaking)
 *   speaking variants → no dependents
 */

import { createTask } from '../task-manager'
import { getImageProvider } from '../image-providers'
import { generateAndStoreImage } from '../image-generation'
import { imageExists, readStaticImage } from '../image-storage'
import { CHARACTER_PROVIDERS } from '../character/characters'
import type { ProfileImageGenerateEvent } from './events'
import { recordImageGenUsage } from '../ai-usage/helpers'
import { AiFeature } from '../ai-usage/features'
import {
  getVariantSuffix,
  type ProfileSize,
  type ProfileTheme,
  type ProfileState,
} from '../profile-variants'
export {
  getVariantSuffix,
  type ProfileSize,
  type ProfileTheme,
  type ProfileState,
} from '../profile-variants'

export interface ProfileImageGenerateInput {
  provider: 'gemini' | 'openai'
  model: string
  characterId: string
  size: ProfileSize
  theme: ProfileTheme
  state?: ProfileState
  cascade?: boolean
  forceRegenerate?: boolean
  _userId?: string
}

export interface ProfileImageGenerateOutput {
  characterId: string
  size: ProfileSize
  theme: ProfileTheme
  state: ProfileState
  status: 'generated' | 'skipped' | 'failed'
  publicUrl?: string
  sizeBytes?: number
  error?: string
  childTaskIds?: string[]
}

/** Size prompt modifiers (used with base image as reference). */
const SIZE_MODIFIERS: Record<'sm' | 'lg', string> = {
  sm:
    'Adapt this portrait for use as a tiny avatar (14-24px display). ' +
    'Tighter crop focused on the face. Simplify fine details that would be lost at small sizes. ' +
    'Bold, clear features. Minimal background. Keep the same character identity and style.',
  lg:
    'Adapt this portrait for use as a featured hero image (120px+ display). ' +
    'Show more of the bust and background. Include geometric construction lines and compass arcs. ' +
    'Higher detail appropriate for large display. Keep the same character identity and style.',
}

/** Theme prompt modifiers (used alongside a reference image). */
const THEME_MODIFIERS: Record<'light' | 'dark', string> = {
  light:
    'Create a light theme variant of this portrait. Keep the same subject, composition, and style. ' +
    'Use a bright, warm palette with cream/ivory background and warm golden tones. ' +
    'Geometric accents in soft primary colors. Optimized for display on a white/light UI.',
  dark:
    'Create a dark theme variant of this portrait. Keep the same subject, composition, and style. ' +
    'Use a deep, rich palette with dark slate/charcoal background and subtle warm undertones. ' +
    'Geometric accents in muted jewel tones. Optimized for display on a dark/black UI.',
}

/** State prompt modifiers (used with idle counterpart as reference). */
const STATE_MODIFIERS: Record<'speaking', string> = {
  speaking:
    'Create a "speaking" variant of this portrait. Keep the same character, composition, and style. ' +
    'The character should have their mouth slightly open as if mid-sentence, with an animated and ' +
    'engaged expression. Subtle hand gesture suggesting explanation or teaching. The expression and ' +
    'pose should be clearly different from the idle/resting variant — this needs to be distinguishable ' +
    'even at small sizes (14-24px). Brighter eyes, more dynamic posture, slight lean forward.',
}

/**
 * Get the dependents that should be fired when a variant completes.
 * Idle variants fire their existing cascade + a speaking counterpart.
 * Speaking variants have no dependents.
 */
function getDependents(
  size: ProfileSize,
  theme: ProfileTheme,
  state: ProfileState
): Array<{ size: ProfileSize; theme: ProfileTheme; state: ProfileState }> {
  // Speaking variants never cascade
  if (state === 'speaking') return []

  const deps: Array<{ size: ProfileSize; theme: ProfileTheme; state: ProfileState }> = []

  // Original cascade logic for idle variants
  if (size === 'default' && theme === 'default') {
    deps.push(
      { size: 'default', theme: 'light', state: 'idle' },
      { size: 'default', theme: 'dark', state: 'idle' },
      { size: 'sm', theme: 'default', state: 'idle' },
      { size: 'lg', theme: 'default', state: 'idle' }
    )
  } else if (theme === 'default' && (size === 'sm' || size === 'lg')) {
    deps.push({ size, theme: 'light', state: 'idle' }, { size, theme: 'dark', state: 'idle' })
  }

  // Every idle variant also fires its speaking counterpart
  deps.push({ size, theme, state: 'speaking' })

  return deps
}

/**
 * Get the reference variant for image-to-image generation.
 * Returns null for the base idle variant (text-only generation).
 * Speaking variants always reference their idle counterpart.
 */
function getReferenceVariant(
  size: ProfileSize,
  theme: ProfileTheme,
  state: ProfileState
): { size: ProfileSize; theme: ProfileTheme; state: ProfileState } | null {
  // Speaking variants reference their idle counterpart
  if (state === 'speaking') return { size, theme, state: 'idle' }
  // Base idle: no reference (text-only)
  if (size === 'default' && theme === 'default') return null
  // Theme variant → its size's base (idle)
  if (theme !== 'default') return { size, theme: 'default', state: 'idle' }
  // Size variant → base (idle)
  return { size: 'default', theme: 'default', state: 'idle' }
}

export async function startProfileImageGeneration(
  input: ProfileImageGenerateInput
): Promise<string> {
  return createTask<
    ProfileImageGenerateInput,
    ProfileImageGenerateOutput,
    ProfileImageGenerateEvent
  >('profile-image-generate', input, async (handle, config) => {
    const configState: ProfileState = config.state ?? 'idle'

    const provider = getImageProvider(config.provider)
    if (!provider) {
      handle.fail(`Unknown image provider: ${config.provider}`)
      return
    }

    if (!provider.isAvailable()) {
      const { envKey, envKeyAlt } = provider.meta
      const keys = envKeyAlt ? `${envKey} or ${envKeyAlt}` : envKey
      handle.fail(
        `No API key configured for ${provider.meta.name}. Set ${keys} in your environment.`
      )
      return
    }

    const character = CHARACTER_PROVIDERS[config.characterId]
    if (!character) {
      handle.fail(`Unknown character: ${config.characterId}`)
      return
    }

    const data = character.getFullData()
    const basePrompt = data.identity.profilePrompt

    // Determine file path based on size + theme + state
    const profileBase = data.identity.profileImage.replace(/^\//, '')
    const suffix = getVariantSuffix(config.size, config.theme, configState)
    const relativePath = profileBase.replace('.png', `${suffix}.png`)

    const storageTarget = { type: 'static' as const, relativePath }

    // Skip if already exists and not force-regenerating
    if (!config.forceRegenerate && imageExists(storageTarget)) {
      handle.complete({
        characterId: config.characterId,
        size: config.size,
        theme: config.theme,
        state: configState,
        status: 'skipped',
        publicUrl: `/${relativePath}`,
      })
      return
    }

    handle.emit({
      type: 'image_started',
      characterId: config.characterId,
      size: config.size,
      theme: config.theme,
      state: configState,
      model: config.model,
      provider: config.provider,
    })

    const variantLabel = suffix ? suffix.slice(1) : 'base'
    handle.setProgress(10, `Generating ${variantLabel} variant for ${data.identity.displayName}`)

    // Load reference image if this variant needs one
    let referenceImage: Buffer | undefined
    const refVariant = getReferenceVariant(config.size, config.theme, configState)
    if (refVariant) {
      const refSuffix = getVariantSuffix(refVariant.size, refVariant.theme, refVariant.state)
      const refRelativePath = profileBase.replace('.png', `${refSuffix}.png`)
      const refBuffer = await readStaticImage(refRelativePath)
      if (refBuffer) {
        referenceImage = refBuffer
      }
    }

    // Build the prompt
    let fullPrompt: string
    if (configState === 'speaking') {
      // Speaking variant: use state modifier with idle counterpart as reference
      if (referenceImage) {
        fullPrompt = STATE_MODIFIERS.speaking
      } else {
        fullPrompt = `${basePrompt} ${STATE_MODIFIERS.speaking}`
      }
    } else if (config.size === 'default' && config.theme === 'default') {
      // Base idle variant: text-only
      fullPrompt = basePrompt
    } else if (config.size !== 'default' && config.theme !== 'default') {
      // Size+theme idle variant (e.g. sm-light): use theme modifier with size's base as reference
      if (referenceImage) {
        fullPrompt = THEME_MODIFIERS[config.theme]
      } else {
        fullPrompt = `${basePrompt} ${SIZE_MODIFIERS[config.size]} ${THEME_MODIFIERS[config.theme]}`
      }
    } else if (config.theme !== 'default') {
      // Theme-only idle variant (e.g. light): theme modifier with base as reference
      if (referenceImage) {
        fullPrompt = THEME_MODIFIERS[config.theme]
      } else {
        fullPrompt = `${basePrompt} ${THEME_MODIFIERS[config.theme]}`
      }
    } else {
      // Size-only idle variant (e.g. sm): size modifier with base as reference
      if (referenceImage) {
        fullPrompt = SIZE_MODIFIERS[config.size as 'sm' | 'lg']
      } else {
        fullPrompt = `${basePrompt} ${SIZE_MODIFIERS[config.size as 'sm' | 'lg']}`
      }
    }

    try {
      const result = await generateAndStoreImage({
        provider: config.provider,
        model: config.model,
        prompt: fullPrompt,
        imageOptions: { size: { width: 1024, height: 1024 } },
        storageTarget,
        referenceImage,
      })

      const sizeBytes = result.sizeBytes ?? 0
      if (config._userId) {
        recordImageGenUsage(config.provider, config.model, {
          userId: config._userId,
          feature: AiFeature.IMAGE_PROFILE,
          backgroundTaskId: handle.id,
        })
      }

      handle.emit({
        type: 'image_complete',
        characterId: config.characterId,
        size: config.size,
        theme: config.theme,
        state: configState,
        filePath: result.publicUrl,
        sizeBytes,
      })

      // Cascade: fire dependent tasks
      let childTaskIds: string[] | undefined
      const dependents = getDependents(config.size, config.theme, configState)
      if (config.cascade && dependents.length > 0) {
        childTaskIds = []
        for (const dep of dependents) {
          const childId = await startProfileImageGeneration({
            ...config,
            size: dep.size,
            theme: dep.theme,
            state: dep.state,
            cascade: true,
            forceRegenerate: true,
          })
          childTaskIds.push(childId)
        }
        handle.emit({
          type: 'children_started',
          children: dependents.map((d, i) => ({
            taskId: childTaskIds![i],
            size: d.size,
            theme: d.theme,
            state: d.state,
          })),
        })
      }

      handle.complete({
        characterId: config.characterId,
        size: config.size,
        theme: config.theme,
        state: configState,
        status: 'generated',
        publicUrl: result.publicUrl,
        sizeBytes,
        childTaskIds,
      })
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)

      handle.emit({
        type: 'image_error',
        characterId: config.characterId,
        size: config.size,
        theme: config.theme,
        state: configState,
        error: errorMsg,
      })

      handle.fail(errorMsg)
    }
  })
}
