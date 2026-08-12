import { css } from '@styled/css'
import Image from 'next/image'
import type { CreateToolPreview } from '@/lib/create-tools/createToolList'

/**
 * How urgently a card's artifact should load.
 *
 * `priority` goes to the whole above-the-fold row, not to one hand-picked
 * "hero" image: which preview is actually the LCP changes with the breakpoint
 * (at 1280px it measured as the flashcard sheet, not the flagship), so guessing
 * one preloads the wrong file. The row is eager either way — priority only
 * raises the hint and adds the preload link, it doesn't add downloads.
 */
export type PreviewLoading = 'priority' | 'lazy'

interface CreateToolPreviewSlotProps {
  preview: CreateToolPreview
  loading: PreviewLoading
  /** `sizes` for the responsive srcset — the card knows its own grid track. */
  sizes: string
  /** CSS `aspect-ratio` for the frame, e.g. `'4 / 3'`. */
  frame: string
}

/**
 * The framed box holding a tool's captured artifact.
 *
 * An earlier version rendered each preview as bespoke SVG/DOM behind an
 * IntersectionObserver; real captures made all of that unnecessary. There is no
 * preview JavaScript in the bundle now — just an image, with `next/image`
 * cutting a 1600px capture down to whatever the phone actually displays (a
 * 1280px viewport pulls the 384px variant).
 *
 * Deliberately NOT `content-visibility: auto`: the subtree is one `<img>`, so
 * there is nothing meaningful to skip, and it makes the browser drop the
 * already-painted preview whenever the card scrolls out of view.
 *
 * The frame's shape comes from the CARD, not the artifact, so every card in a
 * row is the same height and their titles line up. The artifact is `contain`ed
 * inside it and never cropped — the leftover margin is painted in the capture's
 * own backdrop colour, which is what stops it reading as a letterbox. Real
 * cropping belongs in the capture script, applied once to the real render.
 *
 * Because the frame ratio is fixed and declared in CSS, the box is reserved
 * before the bytes arrive: CLS is zero structurally, not by timing.
 *
 * A printed sheet stays white in dark mode — a printout doesn't have one, and
 * tinting it would misrepresent what comes out of the printer.
 */
export function CreateToolPreviewSlot({
  preview,
  loading,
  sizes,
  frame,
}: CreateToolPreviewSlotProps) {
  return (
    <div
      data-element="create-tool-preview"
      data-preview-kind={preview.kind}
      className={css({
        position: 'relative',
        width: '100%',
        overflow: 'hidden',
        borderRadius: { base: 'lg', md: 'xl' },
        border: '1px solid',
        borderColor: 'border.default',
      })}
      style={{ aspectRatio: frame, background: preview.background }}
    >
      <Image
        src={preview.src}
        alt={preview.alt}
        width={preview.width}
        height={preview.height}
        sizes={sizes}
        {...(loading === 'priority' ? { priority: true } : { loading })}
        className={css({
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'contain',
        })}
      />
    </div>
  )
}
