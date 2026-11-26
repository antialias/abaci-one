/**
 * Ready an image for the LLM client: the one place every caller that sends an
 * image (worksheet parse and reparse, grading, postcard review, Euclid's
 * screenshots) passes it through first.
 *
 * Anthropic refuses an image over 5 MB, and over 8000 px on a side; above
 * about 1568 px on the long edge it scales the image down itself, so sending
 * more only costs time and bytes. It also checks the declared media type
 * against the bytes. So: an image that is small enough goes as it is, under
 * the type its bytes say; a bigger one is turned upright (EXIF), scaled to
 * fit 1568 px and re-encoded (PNG if it has transparency, otherwise JPEG).
 *
 * sharp is loaded only when called, so this module is safe to import from
 * code that also runs in the browser.
 */

/** The long edge the API works at; larger images are scaled down to it. */
export const LLM_IMAGE_MAX_EDGE = 1568

/** Under 5 MB once base64-encoded (4/3 of the bytes). */
export const LLM_IMAGE_MAX_BYTES = 3_750_000

const SENDABLE = new Set(['jpeg', 'png', 'gif', 'webp'])

/**
 * @param image A base64 data URL, or the image's bytes
 * @returns A base64 data URL the API will take
 */
export async function prepareImageForLlm(image: string | Buffer): Promise<string> {
  let bytes: Buffer
  if (typeof image === 'string') {
    const match = /^data:[^;,]*;base64,(.+)$/s.exec(image)
    if (!match) return image // not ours to fix; the provider says what it takes
    bytes = Buffer.from(match[1], 'base64')
  } else {
    bytes = image
  }

  const sharp = (await import('sharp')).default
  const meta = await sharp(bytes).metadata()
  const format = meta.format // sharp names JPEG by its decoder, 'jpeg'
  const longEdge = Math.max(meta.width ?? 0, meta.height ?? 0)
  const upright = !meta.orientation || meta.orientation === 1

  if (
    format &&
    SENDABLE.has(format) &&
    longEdge <= LLM_IMAGE_MAX_EDGE &&
    bytes.length <= LLM_IMAGE_MAX_BYTES &&
    upright
  ) {
    return `data:image/${format};base64,${bytes.toString('base64')}`
  }

  const resized = () =>
    sharp(bytes).rotate().resize({
      width: LLM_IMAGE_MAX_EDGE,
      height: LLM_IMAGE_MAX_EDGE,
      fit: 'inside',
      withoutEnlargement: true,
    })

  if (meta.hasAlpha) {
    const png = await resized().png({ compressionLevel: 9 }).toBuffer()
    if (png.length <= LLM_IMAGE_MAX_BYTES) {
      return `data:image/png;base64,${png.toString('base64')}`
    }
  }
  for (const quality of [85, 70, 55]) {
    const jpeg = await resized().flatten({ background: '#ffffff' }).jpeg({ quality }).toBuffer()
    if (jpeg.length <= LLM_IMAGE_MAX_BYTES || quality === 55) {
      return `data:image/jpeg;base64,${jpeg.toString('base64')}`
    }
  }
  throw new Error('unreachable')
}
