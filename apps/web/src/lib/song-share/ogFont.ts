/**
 * Inlined Fraunces font for `next/og` ImageResponse renders.
 *
 * The `next/font/google` setup in `src/lib/fonts.ts` is for client-side CSS,
 * but `ImageResponse` runs server-side and needs the raw .woff2 bytes inlined
 * into its `fonts` option. We fetch the variable build once at module init,
 * cache it, and reuse for every render — the OG image and the iMessage
 * preview MP4 cover both call this.
 *
 * Network failures are non-fatal: callers fall back to a system serif so the
 * preview still renders (just without Fraunces).
 */

let fraunces700Cache: Buffer | null = null
let fraunces700Tried = false

const FRAUNCES_700_URL =
  'https://fonts.gstatic.com/s/fraunces/v37/6NUh8FyLNQOQZAnv9bYEvDiIdE9Ea92uemAk.woff2'

export const FRAUNCES_FONT_STACK = '"Fraunces", Georgia, serif'
export const FALLBACK_SERIF_FONT_STACK = 'Georgia, "Times New Roman", serif'

export async function getFraunces700(): Promise<Buffer | null> {
  if (fraunces700Cache) return fraunces700Cache
  if (fraunces700Tried) return null
  fraunces700Tried = true
  try {
    const res = await fetch(FRAUNCES_700_URL)
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    fraunces700Cache = buf
    return buf
  } catch {
    return null
  }
}

/**
 * Build the `fonts` array + matching CSS font-family string for an
 * `ImageResponse`. Returns the system fallback stack if the network fetch
 * failed (so the caller doesn't need to branch).
 */
export async function getOgFontConfig(): Promise<{
  fonts: { name: string; data: Buffer; weight: 700; style: 'normal' }[] | undefined
  displayFont: string
}> {
  const data = await getFraunces700()
  if (!data) {
    return { fonts: undefined, displayFont: FALLBACK_SERIF_FONT_STACK }
  }
  return {
    fonts: [{ name: 'Fraunces', data, weight: 700, style: 'normal' }],
    displayFont: FRAUNCES_FONT_STACK,
  }
}
