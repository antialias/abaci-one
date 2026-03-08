/**
 * Orchestrator task for generating number-line postcards.
 *
 * Coordinates subtasks:
 *   1. Render reference scenes (inline)
 *   2. Loop: postcard-image-generate → postcard-review (max 3 attempts)
 *   3. postcard-thumbnail-generate
 *   4. Update DB + notify user
 *
 * Each subtask is a first-class background task with its own events,
 * progress tracking, and admin visibility.
 */

import { createTask, awaitTask } from '../task-manager'
import { getImageProvider } from '../image-providers'
import { storeImage, readPersistentImage } from '../image-storage'
import { startPostcardImageGenerate } from './postcard-image-generate'
import { startPostcardReview } from './postcard-review'
import { startPostcardThumbnailGenerate } from './postcard-thumbnail-generate'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { PostcardGenerateEvent } from './events'
import type { PostcardReviewOutput } from './postcard-review'

const MAX_REVIEW_ATTEMPTS = 3

export interface PostcardGenerateInput {
  postcardId: string
  userId: string
}

export interface PostcardGenerateOutput {
  postcardId: string
  imageUrl?: string
  thumbnailUrl?: string
  status: 'ready' | 'failed'
  error?: string
}

export async function startPostcardGenerate(input: PostcardGenerateInput): Promise<string> {
  return createTask<PostcardGenerateInput, PostcardGenerateOutput, PostcardGenerateEvent>(
    'postcard-generate',
    input,
    async (handle, config) => {
      const { postcardId } = config
      const parentTaskId = handle.id

      // 1. Load postcard record
      const [postcard] = await db
        .select()
        .from(schema.numberLinePostcards)
        .where(eq(schema.numberLinePostcards.id, postcardId))
        .limit(1)

      if (!postcard) {
        handle.fail(`Postcard ${postcardId} not found`)
        return
      }

      const manifest = postcard.manifest

      // 2. Update status to generating
      await db
        .update(schema.numberLinePostcards)
        .set({ status: 'generating', updatedAt: new Date() })
        .where(eq(schema.numberLinePostcards.id, postcardId))

      handle.emit({ type: 'postcard_rendering', postcardId })
      handle.setProgress(5, 'Preparing number line scene')

      // 3. Render reference scenes and store for subtask access
      let referenceImageKey: string | undefined
      try {
        const { createServerCanvas } = await import('../server-canvas')
        const { renderMomentScene } = await import(
          '@/components/toys/number-line/renderMomentScene'
        )

        const momentCount = Math.min(manifest.moments.length, 4)
        let referenceImage: Buffer | undefined

        if (momentCount === 1) {
          const width = 800
          const height = 600
          const canvas = createServerCanvas(width, height)
          const ctx = canvas.getContext('2d')
          renderMomentScene(
            ctx as unknown as CanvasRenderingContext2D,
            manifest.moments[0].snapshot,
            width,
            height
          )
          referenceImage = canvas.toBuffer('image/png')
        } else if (momentCount > 1) {
          const tileW = 400
          const tileH = 300
          const canvas = createServerCanvas(800, 600)
          const ctx = canvas.getContext('2d')
          for (let i = 0; i < momentCount; i++) {
            const tileCanvas = createServerCanvas(tileW, tileH)
            const tileCtx = tileCanvas.getContext('2d')
            renderMomentScene(
              tileCtx as unknown as CanvasRenderingContext2D,
              manifest.moments[i].snapshot,
              tileW,
              tileH
            )
            const col = i % 2
            const row = Math.floor(i / 2)
            ;(ctx as unknown as CanvasRenderingContext2D).drawImage(
              tileCanvas as unknown as CanvasImageSource,
              col * tileW,
              row * tileH
            )
          }
          referenceImage = canvas.toBuffer('image/png')
        }

        if (referenceImage) {
          // Store reference image so subtasks can read it by key
          const refFilename = `${postcardId}-reference.png`
          storeImage(
            { type: 'persistent', category: 'postcards', filename: refFilename },
            referenceImage
          )
          referenceImageKey = `postcards/${refFilename}`
          handle.setProgress(10, 'Number line scene rendered')
        }
      } catch (err) {
        console.warn('[postcard-generate] Scene render failed, continuing without reference:', err)
        handle.setProgress(10, 'Skipping scene render, generating image directly')
      }

      // 4. Select provider
      const gemini = getImageProvider('gemini')
      const openai = getImageProvider('openai')
      const provider = gemini?.isAvailable() ? gemini : openai?.isAvailable() ? openai : null
      if (!provider) {
        await db
          .update(schema.numberLinePostcards)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(schema.numberLinePostcards.id, postcardId))
        handle.fail('No image generation provider available')
        return
      }

      const callerNum = manifest.callerNumber
      const displayNum = Number.isInteger(callerNum)
        ? callerNum.toString()
        : callerNum.toPrecision(6)
      const momentDescriptions = manifest.moments
        .slice(0, 4)
        .map((m, i) => `${i + 1}. "${m.caption}" (${m.category})`)
        .join('\n')

      const hasScreenshots = !!referenceImageKey

      const basePrompt = [
        `Create a postcard commemorating a phone call between a child named ${manifest.childName}${manifest.childAge ? ` (age ${manifest.childAge})` : ''} and the number ${displayNum} on the number line.`,
        ``,
        `The number's personality: ${manifest.callerPersonality}`,
        ``,
        `Key moments from the call:`,
        momentDescriptions,
        ``,
        `Session summary: ${manifest.sessionSummary}`,
        ``,
        hasScreenshots
          ? `IMPORTANT: The attached image contains actual screenshots from the call showing the number line at key moments. These screenshots should be incorporated into the postcard as "photos" — like snapshots pinned to a scrapbook or corkboard. They are the real visual record of the experience. Frame them, tilt them slightly, add decorative tape or pins, but keep the screenshot content clearly visible and recognizable. The postcard should feel like a collage of memories from the call.`
          : `Style: warm, playful, mathematical. Include the number ${displayNum} prominently with number line elements.`,
        ``,
        `The overall postcard should feel warm, playful, and nostalgic — like a keepsake from a fun mathematical adventure. Include the number ${displayNum} as a character or prominent element.`,
      ].join('\n')

      const modelId =
        provider.meta.id === 'gemini' ? 'gemini-3-pro-image-preview' : provider.meta.models[0].id

      handle.emit({
        type: 'postcard_generating_image',
        postcardId,
        provider: provider.meta.id,
        model: modelId,
      })

      // 5. Generate-review loop via subtasks
      let acceptedImagePath: string | undefined
      let reviewFeedback: string | undefined

      try {
        for (let attempt = 1; attempt <= MAX_REVIEW_ATTEMPTS; attempt++) {
          if (handle.isCancelled()) return

          const prompt = reviewFeedback ? `${basePrompt}\n\n${reviewFeedback}` : basePrompt

          handle.setProgress(
            15 + attempt * 15,
            `Generating image (attempt ${attempt}/${MAX_REVIEW_ATTEMPTS})`
          )

          // Subtask: generate image
          const genTaskId = await startPostcardImageGenerate(
            {
              postcardId,
              prompt,
              providerId: provider.meta.id,
              modelId,
              attempt,
              referenceImageKey,
              _userId: input.userId,
            },
            input.userId,
            parentTaskId
          )

          const genState = await awaitTask<{ postcardId: string; imagePath: string }>(genTaskId)
          const imagePath = genState.output!.imagePath

          handle.emit({ type: 'postcard_reviewing', postcardId, attempt })
          handle.setProgress(
            20 + attempt * 15,
            `Reviewing image (attempt ${attempt}/${MAX_REVIEW_ATTEMPTS})`
          )

          // Subtask: review image
          const reviewTaskId = await startPostcardReview(
            {
              postcardId,
              imagePath,
              manifest,
              hasReferenceScreenshots: hasScreenshots,
              previousFeedback: reviewFeedback,
            },
            input.userId,
            parentTaskId
          )

          const reviewState = await awaitTask<PostcardReviewOutput>(reviewTaskId)
          const reviewResult = reviewState.output!

          handle.emit({
            type: 'postcard_review_result',
            postcardId,
            attempt,
            pass: reviewResult.pass,
            issues: reviewResult.criteriaResults.flatMap((r) => r.issues),
          })

          if (reviewResult.pass) {
            acceptedImagePath = imagePath
            break
          }

          // Last attempt — accept what we have
          if (attempt === MAX_REVIEW_ATTEMPTS) {
            console.warn(
              `[postcard-generate] Review failed after ${MAX_REVIEW_ATTEMPTS} attempts, accepting best effort`
            )
            acceptedImagePath = imagePath
            break
          }

          reviewFeedback = reviewResult.feedback
        }

        // 6. Copy accepted draft to final location
        const [draftCategory, draftFilename] = acceptedImagePath!.split('/')
        const draftData = await readPersistentImage(draftCategory, draftFilename)
        if (!draftData) {
          throw new Error(`Draft image not found at ${acceptedImagePath}`)
        }

        const { publicUrl: imageUrl } = storeImage(
          { type: 'persistent', category: 'postcards', filename: `${postcardId}.png` },
          draftData.buffer
        )

        // 7. Generate thumbnail via subtask
        handle.setProgress(80, 'Generating thumbnail')

        const thumbnailPrompt = [
          `Create a simple, iconic thumbnail image for a postcard from the number ${displayNum}.`,
          `The number's personality: ${manifest.callerPersonality}.`,
          `Style: warm, colorful, mathematical. Show ${displayNum} as a friendly character.`,
          `Simple composition suitable for a small thumbnail. No text or words.`,
        ].join(' ')

        const thumbTaskId = await startPostcardThumbnailGenerate(
          {
            postcardId,
            prompt: thumbnailPrompt,
            providerId: provider.meta.id,
            modelId,
            _userId: input.userId,
          },
          input.userId,
          parentTaskId
        )

        const thumbState = await awaitTask<{ thumbnailUrl: string }>(thumbTaskId)
        const thumbnailUrl = thumbState.output!.thumbnailUrl

        // 8. Update postcard record
        await db
          .update(schema.numberLinePostcards)
          .set({
            status: 'ready',
            imageUrl,
            thumbnailUrl,
            updatedAt: new Date(),
          })
          .where(eq(schema.numberLinePostcards.id, postcardId))

        handle.emit({
          type: 'postcard_complete',
          postcardId,
          imageUrl,
          thumbnailUrl,
        })

        // 9. Notify user
        try {
          const { bootstrapChannels } = await import('../notifications/bootstrap')
          bootstrapChannels()
          const { notifyUser } = await import('../notifications/dispatcher')
          await notifyUser(postcard.userId, {
            type: 'postcard-ready',
            data: {
              postcardId,
              callerNumber: manifest.callerNumber,
              imageUrl,
              thumbnailUrl,
              postcardUrl: `/my-stuff/postcards/${postcardId}`,
            },
          })
        } catch (notifyErr) {
          console.error('[postcard-generate] Failed to send notification:', notifyErr)
        }

        handle.complete({
          postcardId,
          imageUrl,
          thumbnailUrl,
          status: 'ready',
        })
      } catch (err) {
        const error = err instanceof Error ? err.message : 'Image generation failed'
        await db
          .update(schema.numberLinePostcards)
          .set({ status: 'failed', updatedAt: new Date() })
          .where(eq(schema.numberLinePostcards.id, postcardId))

        handle.emit({ type: 'postcard_error', postcardId, error })
        handle.fail(error)
      }
    },
    input.userId
  )
}
