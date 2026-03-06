/**
 * Background task for generating number-line postcards.
 *
 * Flow:
 * 1. Load postcard record from DB
 * 2. Server-side re-render the best moment's number line scene
 * 3. Generate an AI postcard image using the scene as reference
 * 4. Store image + thumbnail
 * 5. Update postcard record with URLs
 */

import { createTask } from '../task-manager'
import { getImageProvider } from '../image-providers'
import { generateAndStoreImage } from '../image-generation'
import { db } from '@/db'
import * as schema from '@/db/schema'
import { eq } from 'drizzle-orm'
import type { PostcardGenerateEvent } from './events'

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
      handle.setProgress(10, 'Preparing number line scene')

      // 3. Try to render the number line scene as a reference image
      let referenceImage: Buffer | undefined
      try {
        // Dynamic import to avoid loading @napi-rs/canvas in client bundles
        const { createServerCanvas } = await import('../server-canvas')
        const { renderNumberLine } = await import('@/components/toys/number-line/renderNumberLine')

        const bestMoment = manifest.moments[0]
        if (bestMoment) {
          const width = 800
          const height = 600
          const canvas = createServerCanvas(width, height)
          const ctx = canvas.getContext('2d')

          const state = {
            center: bestMoment.snapshot.viewport.center,
            pixelsPerUnit: bestMoment.snapshot.viewport.pixelsPerUnit,
          }

          // Render the number line scene at the moment's viewport
          renderNumberLine(
            ctx as unknown as CanvasRenderingContext2D,
            state,
            width,
            height,
            false // isDark
          )

          referenceImage = canvas.toBuffer('image/png')
          handle.setProgress(30, 'Number line scene rendered')
        }
      } catch (err) {
        // Non-fatal — we can still generate without the reference
        console.warn('[postcard-generate] Scene render failed, continuing without reference:', err)
        handle.setProgress(30, 'Skipping scene render, generating image directly')
      }

      // 4. Generate AI postcard image
      const provider = getImageProvider('openai') ?? getImageProvider('gemini')
      if (!provider || !provider.isAvailable()) {
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
        .slice(0, 3)
        .map((m) => m.caption)
        .join('. ')

      const prompt = [
        `Create a whimsical, colorful postcard from the number ${displayNum} on the number line.`,
        `The number's personality: ${manifest.callerPersonality}.`,
        `This postcard commemorates a phone call with a child named ${manifest.childName}.`,
        `Key moments: ${momentDescriptions}.`,
        `Style: warm, playful, mathematical. Include the number ${displayNum} prominently.`,
        `Include subtle math elements (number line, tick marks, mathematical symbols).`,
        `The mood should be friendly and nostalgic, like a postcard from a friend.`,
        `Do NOT include any text or words on the image.`,
      ].join(' ')

      handle.emit({
        type: 'postcard_generating_image',
        postcardId,
        provider: provider.meta.id,
        model: provider.meta.models[0].id,
      })
      handle.setProgress(50, 'Generating postcard image')

      try {
        const result = await generateAndStoreImage({
          provider: provider.meta.id,
          model: provider.meta.models[0].id,
          prompt,
          imageOptions: { size: { width: 1024, height: 768 } },
          storageTarget: {
            type: 'persistent',
            category: 'postcards',
            filename: `${postcardId}.png`,
          },
          referenceImage,
        })

        handle.setProgress(80, 'Generating thumbnail')

        // Generate a smaller thumbnail
        const thumbnailResult = await generateAndStoreImage({
          provider: provider.meta.id,
          model: provider.meta.models[0].id,
          prompt: prompt + ' Simple, iconic version suitable for a small thumbnail.',
          imageOptions: { size: { width: 256, height: 192 } },
          storageTarget: {
            type: 'persistent',
            category: 'postcards',
            filename: `${postcardId}-thumb.png`,
          },
          referenceImage,
        })

        // 5. Update postcard record
        const imageUrl = result.publicUrl
        const thumbnailUrl = thumbnailResult.publicUrl

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

        // Notify the user that their postcard is ready
        try {
          const { bootstrapChannels } = await import('../notifications/bootstrap')
          bootstrapChannels()
          const { notifyUser } = await import('../notifications/dispatcher')
          await notifyUser(postcard.userId, {
            type: 'postcard-ready',
            data: {
              postcardId,
              callerNumber: manifest.callerNumber,
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
