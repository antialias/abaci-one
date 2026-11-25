import {
  PHI_EXPLORE_PROMPT_PREFIX,
  PHI_EXPLORE_SUBJECTS,
  PHI_EXPLORE_THEME_MODIFIERS,
} from '@/components/toys/number-line/constants/phiExploreData'
import { AiFeature } from '../ai-usage/features'
import { recordImageGenUsage } from '../ai-usage/helpers'
import { generateAndStoreImage } from '../image-generation'
import { imageExists } from '../image-storage'
import {
  DEFAULT_IMAGE_CLASS,
  isImageGenerationConfigured,
  NOT_CONFIGURED_MESSAGE,
} from '../images/switch-images'
import { createTask } from '../task-manager'
import type { PhiExploreGenerateEvent } from './events'

export interface PhiExploreGenerateInput {
  /** Image class to ask the switch proxy for; defaults to DEFAULT_IMAGE_CLASS. */
  imageClass?: string
  targets: Array<{ subjectId: string; theme?: 'light' | 'dark' }>
  forceRegenerate?: boolean
  _userId?: string
}

export interface PhiExploreGenerateOutput {
  generated: number
  skipped: number
  failed: number
  results: Array<{
    subjectId: string
    theme?: 'light' | 'dark'
    status: 'generated' | 'skipped' | 'failed'
    error?: string
  }>
}

/**
 * Start a phi explore image generation background task.
 *
 * Generates golden-ratio subject illustrations through the switch proxy, by image class.
 * Reports per-image progress via task events.
 */
export async function startPhiExploreGeneration(input: PhiExploreGenerateInput): Promise<string> {
  return createTask<PhiExploreGenerateInput, PhiExploreGenerateOutput, PhiExploreGenerateEvent>(
    'phi-explore-generate',
    input,
    async (handle, config) => {
      if (!isImageGenerationConfigured()) {
        handle.fail(NOT_CONFIGURED_MESSAGE)
        return
      }
      const imageClass = config.imageClass || DEFAULT_IMAGE_CLASS

      // Build lookup for subject data
      const subjectMap = new Map(PHI_EXPLORE_SUBJECTS.map((s) => [s.id, s]))

      // Determine work items
      const results: PhiExploreGenerateOutput['results'] = []
      let generated = 0
      let skipped = 0
      let failed = 0
      let consecutiveErrors = 0
      const MAX_CONSECUTIVE_ERRORS = 3

      const total = config.targets.length

      handle.setProgress(0, `Starting generation of ${total} phi explore images`)

      for (let i = 0; i < config.targets.length; i++) {
        if (handle.isCancelled()) break

        const target = config.targets[i]
        const subject = subjectMap.get(target.subjectId)
        if (!subject) {
          results.push({
            subjectId: target.subjectId,
            theme: target.theme,
            status: 'failed',
            error: `Unknown subject: ${target.subjectId}`,
          })
          failed++
          continue
        }

        const themeSuffix = target.theme ? `-${target.theme}` : ''
        const filename = `${target.subjectId}${themeSuffix}.png`
        const storageTarget = {
          type: 'static' as const,
          relativePath: `images/constants/phi-explore/${filename}`,
        }

        // Skip if already exists and not force-regenerating
        if (!config.forceRegenerate && imageExists(storageTarget)) {
          results.push({
            subjectId: target.subjectId,
            theme: target.theme,
            status: 'skipped',
          })
          skipped++
          const progress = Math.round(((i + 1) / total) * 100)
          handle.setProgress(
            progress,
            `Skipped ${subject.name}${target.theme ? ` (${target.theme})` : ''} (already exists)`
          )
          continue
        }

        handle.emit({
          type: 'image_started',
          subjectId: target.subjectId,
          imageClass,
          ...(target.theme && { theme: target.theme }),
        })

        handle.emit({
          type: 'batch_progress',
          completed: generated + skipped + failed,
          total,
          currentSubject: subject.name,
          ...(target.theme && { theme: target.theme }),
        })

        // Build the full prompt
        const themeModifier = target.theme ? ` ${PHI_EXPLORE_THEME_MODIFIERS[target.theme]}` : ''
        const fullPrompt = `${PHI_EXPLORE_PROMPT_PREFIX} ${subject.prompt}${themeModifier}`

        try {
          const result = await generateAndStoreImage({
            imageClass,
            prompt: fullPrompt,
            storageTarget,
          })

          const sizeBytes = result.status === 'generated' ? result.sizeBytes : 0

          generated++
          consecutiveErrors = 0
          if (config._userId && result.status === 'generated') {
            recordImageGenUsage(result, {
              userId: config._userId,
              feature: AiFeature.IMAGE_PHI_EXPLORE,
              backgroundTaskId: handle.id,
            })
          }

          handle.emit({
            type: 'image_complete',
            subjectId: target.subjectId,
            filePath: result.publicUrl,
            sizeBytes,
            ...(target.theme && { theme: target.theme }),
          })

          results.push({
            subjectId: target.subjectId,
            theme: target.theme,
            status: 'generated',
          })
        } catch (err) {
          failed++
          consecutiveErrors++
          const errorMsg = err instanceof Error ? err.message : String(err)

          handle.emit({
            type: 'image_error',
            subjectId: target.subjectId,
            error: errorMsg,
            ...(target.theme && { theme: target.theme }),
          })

          results.push({
            subjectId: target.subjectId,
            theme: target.theme,
            status: 'failed',
            error: errorMsg,
          })

          if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
            handle.fail(
              `Generation aborted after ${MAX_CONSECUTIVE_ERRORS} consecutive failures: ${errorMsg}`
            )
            return
          }
        }

        const progress = Math.round(((i + 1) / total) * 100)
        handle.setProgress(
          progress,
          `${generated + skipped + failed}/${total} — ${generated} generated, ${skipped} skipped, ${failed} failed`
        )
      }

      handle.emit({
        type: 'batch_complete',
        generated,
        skipped,
        failed,
      })

      handle.complete({ generated, skipped, failed, results })
    }
  )
}
