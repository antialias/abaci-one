/**
 * Image generation through the switch proxy's Images API.
 *
 * abaci names what *kind* of image it wants (an image class, e.g.
 * `image-best`) and the proxy decides who draws it. New providers or a
 * subscription becoming usable reach abaci with no code change here.
 *
 * - `SWITCH_MEDIA_URL`   base URL of the proxy's media door
 * - `SWITCH_MEDIA_LOGIN` opaque credential, sent as `Authorization: Bearer`
 *
 * The class travels ONLY in the `X-Switch-Class` request header; the proxy
 * refuses a `model` field that isn't a class name, so none is sent.
 *
 * Env is read at call time so runtime env always wins over build-time values.
 */

/** Kid-facing images need correct text and numbers; cheaper classes garble them. */
export const DEFAULT_IMAGE_CLASS = 'image-best'

export const NOT_CONFIGURED_MESSAGE =
  "Image generation isn't configured: set SWITCH_MEDIA_URL and SWITCH_MEDIA_LOGIN"

export interface ImageSize {
  width: number
  height: number
}

export interface GenerateImageRequest {
  prompt: string
  /** Image class to ask the proxy for. Defaults to {@link DEFAULT_IMAGE_CLASS}. */
  imageClass?: string
  size?: ImageSize
  /** Reference image (PNG) for image-to-image generation; uses the edits endpoint. */
  referenceImage?: Buffer
}

export interface GeneratedImage {
  imageBuffer: Buffer
  /** Class that served the request (from the `X-Switch-Class` response header). */
  imageClass: string
  /** Member that drew it, e.g. `runway/gpt_image_2` (from `X-Switch-Member`). */
  member: string | null
}

export interface ImageClassInfo {
  id: string
  displayName: string
  summary: string
  isDefault: boolean
}

function mediaConfig(): { baseUrl: string; login: string } | null {
  const baseUrl = process.env.SWITCH_MEDIA_URL?.trim()
  const login = process.env.SWITCH_MEDIA_LOGIN?.trim()
  if (!baseUrl || !login) return null
  return { baseUrl: baseUrl.replace(/\/+$/, ''), login }
}

export function isImageGenerationConfigured(): boolean {
  return mediaConfig() !== null
}

/**
 * Validate an optional `imageClass` from a request body. Missing/empty means
 * the default class; anything else must be a string. The proxy is the
 * authority on which classes exist, so no list is checked here.
 */
export function parseImageClassParam(
  value: unknown
): { ok: true; imageClass: string } | { ok: false; error: string } {
  if (value === undefined || value === null || value === '') {
    return { ok: true, imageClass: DEFAULT_IMAGE_CLASS }
  }
  if (typeof value !== 'string' || value.trim().length === 0) {
    return { ok: false, error: 'imageClass must be a non-empty string' }
  }
  return { ok: true, imageClass: value.trim() }
}

type ImageSizeString = '1024x1024' | '1024x1536' | '1536x1024' | 'auto'

/** Pick the closest size string every image class accepts. */
export function mapImageSize(size?: ImageSize): ImageSizeString {
  if (!size) return 'auto'
  const ratio = size.width / size.height
  if (ratio > 1.2) return '1536x1024' // landscape
  if (ratio < 0.8) return '1024x1536' // portrait
  return '1024x1024' // square-ish
}

function parseProxyError(status: number, body: string): string {
  try {
    const json = JSON.parse(body)
    const message = json?.error?.message || json?.message || json?.error
    if (typeof message === 'string') {
      return `Image proxy ${status}: ${message.split('\n')[0].trim()}`
    }
  } catch {
    // Not JSON
  }
  const truncated = body.length > 200 ? `${body.slice(0, 200)}...` : body
  return `Image proxy error ${status}: ${truncated}`
}

export async function generateImage(req: GenerateImageRequest): Promise<GeneratedImage> {
  const config = mediaConfig()
  if (!config) throw new Error(NOT_CONFIGURED_MESSAGE)

  const imageClass = req.imageClass || DEFAULT_IMAGE_CLASS
  const size = mapImageSize(req.size)
  const headers: Record<string, string> = {
    Authorization: `Bearer ${config.login}`,
    'X-Switch-Class': imageClass,
  }

  let response: Response
  if (req.referenceImage) {
    const form = new FormData()
    form.append('prompt', req.prompt)
    form.append('size', size)
    form.append(
      'image',
      new Blob([new Uint8Array(req.referenceImage)], { type: 'image/png' }),
      'reference.png'
    )
    response = await fetch(`${config.baseUrl}/v1/images/edits`, {
      method: 'POST',
      headers,
      body: form,
    })
  } else {
    response = await fetch(`${config.baseUrl}/v1/images/generations`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: req.prompt, size }),
    })
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(parseProxyError(response.status, body))
  }

  const data = await response.json()
  const b64 = data?.data?.[0]?.b64_json
  if (typeof b64 !== 'string' || b64.length === 0) {
    throw new Error('Image proxy returned no image data')
  }

  return {
    imageBuffer: Buffer.from(b64, 'base64'),
    imageClass: response.headers.get('X-Switch-Class') || imageClass,
    member: response.headers.get('X-Switch-Member'),
  }
}

const CLASS_CACHE_TTL_MS = 60_000
const CLASS_LIST_TIMEOUT_MS = 5_000
let classCache: { at: number; classes: ImageClassInfo[] } | null = null

/** Test hook: forget the cached class list. */
export function clearImageClassCache(): void {
  classCache = null
}

/**
 * Image classes the proxy offers right now, from `GET /v1/models`
 * (image modality only). Cached in memory for ~60 s, fetched on demand.
 *
 * Never throws: on any failure it returns an empty list (and logs), so page
 * renders and status routes keep working; callers show "no classes".
 */
export async function listImageClasses(): Promise<ImageClassInfo[]> {
  const config = mediaConfig()
  if (!config) return []
  if (classCache && Date.now() - classCache.at < CLASS_CACHE_TTL_MS) {
    return classCache.classes
  }

  try {
    const response = await fetch(`${config.baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${config.login}` },
      // Status routes await this; a hung proxy must not hang the admin page.
      signal: AbortSignal.timeout(CLASS_LIST_TIMEOUT_MS),
    })
    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(
        `[switch-images] listing classes failed: ${parseProxyError(response.status, body)}`
      )
      return []
    }
    const json = await response.json()
    // OpenAI-style `{ data: [...] }`; tolerate a bare array too.
    const entries: unknown[] = Array.isArray(json)
      ? json
      : Array.isArray(json?.data)
        ? json.data
        : []
    const classes: ImageClassInfo[] = []
    for (const entry of entries) {
      const e = entry as Record<string, unknown>
      if (e?.modality !== 'image' || typeof e.id !== 'string') continue
      classes.push({
        id: e.id,
        displayName: typeof e.display_name === 'string' ? e.display_name : e.id,
        summary: typeof e.summary === 'string' ? e.summary : '',
        isDefault: e.default === true,
      })
    }
    classCache = { at: Date.now(), classes }
    return classes
  } catch (err) {
    console.error(
      `[switch-images] listing classes failed: ${err instanceof Error ? err.message : String(err)}`
    )
    return []
  }
}

/** Shape admin status routes return so pages can offer an image-class select. */
export interface ImageClassStatus {
  imageClasses: ImageClassInfo[]
  defaultImageClass: string
  configured: boolean
}

export async function getImageClassStatus(): Promise<ImageClassStatus> {
  return {
    imageClasses: await listImageClasses(),
    defaultImageClass: DEFAULT_IMAGE_CLASS,
    configured: isImageGenerationConfigured(),
  }
}
