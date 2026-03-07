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

      // 3. Try to render the number line scene(s) as a reference image
      let referenceImage: Buffer | undefined
      try {
        // Dynamic import to avoid loading @napi-rs/canvas in client bundles
        const { createServerCanvas } = await import('../server-canvas')
        const { renderMomentScene } = await import(
          '@/components/toys/number-line/renderMomentScene'
        )

        const momentCount = Math.min(manifest.moments.length, 4)

        if (momentCount === 1) {
          // Single moment — render full-size
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
          // Multiple moments — render as a 2x2 tiled grid
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
          handle.setProgress(30, 'Number line scene rendered')
        }
      } catch (err) {
        // Non-fatal — we can still generate without the reference
        console.warn('[postcard-generate] Scene render failed, continuing without reference:', err)
        handle.setProgress(30, 'Skipping scene render, generating image directly')
      }

      // 4. Generate AI postcard image
      // Prefer Gemini (Nano Banana Pro) — it handles reference images natively
      // as inline content, producing collage-style output that incorporates the
      // actual screenshots. Fall back to OpenAI if Gemini is unavailable.
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

      const hasScreenshots = !!referenceImage

      const prompt = [
        `Create a postcard commemorating a phone call between a child named ${manifest.childName} and the number ${displayNum} on the number line.`,
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
        `Do NOT include any text, words, or letters on the image.`,
      ].join('\n')

      // Use Nano Banana Pro for Gemini, first model for OpenAI
      const modelId =
        provider.meta.id === 'gemini' ? 'gemini-3-pro-image-preview' : provider.meta.models[0].id

      handle.emit({
        type: 'postcard_generating_image',
        postcardId,
        provider: provider.meta.id,
        model: modelId,
      })
      handle.setProgress(50, 'Generating postcard image')

      try {
        const result = await generateAndStoreImage({
          provider: provider.meta.id,
          model: modelId,
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

        // Generate a smaller thumbnail — no reference image needed,
        // just a simplified version of the postcard concept
        const thumbnailPrompt = [
          `Create a simple, iconic thumbnail image for a postcard from the number ${displayNum}.`,
          `The number's personality: ${manifest.callerPersonality}.`,
          `Style: warm, colorful, mathematical. Show ${displayNum} as a friendly character.`,
          `Simple composition suitable for a small thumbnail. No text or words.`,
        ].join(' ')

        const thumbnailResult = await generateAndStoreImage({
          provider: provider.meta.id,
          model: modelId,
          prompt: thumbnailPrompt,
          imageOptions: { size: { width: 256, height: 192 } },
          storageTarget: {
            type: 'persistent',
            category: 'postcards',
            filename: `${postcardId}-thumb.png`,
          },
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
