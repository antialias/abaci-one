/**
 * @vitest-environment node
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearImageClassCache,
  DEFAULT_IMAGE_CLASS,
  generateImage,
  getImageClassStatus,
  isImageGenerationConfigured,
  listImageClasses,
  parseImageClassParam,
} from '../switch-images'

const BASE = 'http://proxy.test:8788'
const LOGIN = 'opaque-login'
const PNG_B64 = Buffer.from('fake-png').toString('base64')

function imageResponse(headers: Record<string, string> = {}) {
  return new Response(JSON.stringify({ data: [{ b64_json: PNG_B64 }] }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  })
}

const fetchMock = vi.fn<[input: string | URL | Request, init?: RequestInit], Promise<Response>>()

function headersOf(init: RequestInit | undefined): Record<string, string> {
  return (init?.headers ?? {}) as Record<string, string>
}

beforeEach(() => {
  vi.stubEnv('SWITCH_MEDIA_URL', `${BASE}/`)
  vi.stubEnv('SWITCH_MEDIA_LOGIN', LOGIN)
  vi.stubGlobal('fetch', fetchMock)
  fetchMock.mockReset()
  clearImageClassCache()
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('isImageGenerationConfigured', () => {
  it('needs both env vars, read at call time', () => {
    expect(isImageGenerationConfigured()).toBe(true)
    vi.stubEnv('SWITCH_MEDIA_LOGIN', '')
    expect(isImageGenerationConfigured()).toBe(false)
    vi.stubEnv('SWITCH_MEDIA_LOGIN', LOGIN)
    vi.stubEnv('SWITCH_MEDIA_URL', '')
    expect(isImageGenerationConfigured()).toBe(false)
  })
})

describe('generateImage', () => {
  it('posts a generation with the class header, Bearer login, mapped size and no model', async () => {
    fetchMock.mockResolvedValue(
      imageResponse({ 'X-Switch-Class': 'image-draft', 'X-Switch-Member': 'local/flux' })
    )

    const result = await generateImage({
      prompt: 'a friendly seven',
      imageClass: 'image-draft',
      size: { width: 1600, height: 900 },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/v1/images/generations`)
    const headers = headersOf(init)
    expect(headers['X-Switch-Class']).toBe('image-draft')
    expect(headers.Authorization).toBe(`Bearer ${LOGIN}`)
    const body = JSON.parse(init?.body as string)
    expect(body).toEqual({ prompt: 'a friendly seven', size: '1536x1024' })
    expect(body).not.toHaveProperty('model')

    expect(result.imageBuffer.toString()).toBe('fake-png')
    expect(result.imageClass).toBe('image-draft')
    expect(result.member).toBe('local/flux')
  })

  it('defaults the class and maps portrait/square/absent sizes', async () => {
    fetchMock.mockImplementation(async () => imageResponse())

    const r = await generateImage({ prompt: 'p', size: { width: 768, height: 1024 } })
    await generateImage({ prompt: 'p', size: { width: 1000, height: 1000 } })
    await generateImage({ prompt: 'p' })

    const sizes = fetchMock.mock.calls.map(([, init]) => JSON.parse(init?.body as string).size)
    expect(sizes).toEqual(['1024x1536', '1024x1024', 'auto'])
    const header = headersOf(fetchMock.mock.calls[0][1])['X-Switch-Class']
    expect(header).toBe(DEFAULT_IMAGE_CLASS)
    // No response headers: class falls back to the requested one, member is unknown
    expect(r.imageClass).toBe(DEFAULT_IMAGE_CLASS)
    expect(r.member).toBeNull()
  })

  it('uses the edits endpoint with multipart when given a reference image', async () => {
    fetchMock.mockResolvedValue(imageResponse({ 'X-Switch-Member': 'runway/gpt_image_2' }))

    const result = await generateImage({
      prompt: 'same character, dark theme',
      imageClass: 'image-best',
      size: { width: 1024, height: 1024 },
      referenceImage: Buffer.from('ref-png'),
    })

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/v1/images/edits`)
    const headers = headersOf(init)
    expect(headers['X-Switch-Class']).toBe('image-best')
    expect(headers.Authorization).toBe(`Bearer ${LOGIN}`)
    expect(headers['Content-Type']).toBeUndefined() // fetch sets the multipart boundary
    const form = init?.body as FormData
    expect(form).toBeInstanceOf(FormData)
    expect(form.get('prompt')).toBe('same character, dark theme')
    expect(form.get('size')).toBe('1024x1024')
    expect(form.has('model')).toBe(false)
    const image = form.get('image') as File
    expect(image.type).toBe('image/png')
    expect(Buffer.from(await image.arrayBuffer()).toString()).toBe('ref-png')
    expect(result.member).toBe('runway/gpt_image_2')
  })

  it("surfaces the proxy's error message", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'unknown class "nope"\nmore detail' } }), {
        status: 400,
      })
    )
    await expect(generateImage({ prompt: 'p', imageClass: 'nope' })).rejects.toThrow(
      'Image proxy 400: unknown class "nope"'
    )
  })

  it('reports a non-JSON error body', async () => {
    fetchMock.mockResolvedValue(new Response('bad gateway', { status: 502 }))
    await expect(generateImage({ prompt: 'p' })).rejects.toThrow(
      'Image proxy error 502: bad gateway'
    )
  })

  it('throws the not-configured error without calling the proxy', async () => {
    vi.stubEnv('SWITCH_MEDIA_URL', '')
    await expect(generateImage({ prompt: 'p' })).rejects.toThrow(
      "Image generation isn't configured: set SWITCH_MEDIA_URL and SWITCH_MEDIA_LOGIN"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects a response with no image', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }))
    await expect(generateImage({ prompt: 'p' })).rejects.toThrow('no image data')
  })
})

describe('listImageClasses', () => {
  const models = {
    data: [
      {
        id: 'image',
        modality: 'image',
        display_name: 'Image',
        summary: 'local first',
        default: true,
      },
      { id: 'image-best', modality: 'image', display_name: 'Best', summary: 'runway' },
      { id: 'abaci', modality: 'text', display_name: 'Abaci text' },
    ],
  }

  it('keeps image-modality entries only, with the Bearer login', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(models), { status: 200 }))

    const classes = await listImageClasses()

    expect(classes).toEqual([
      { id: 'image', displayName: 'Image', summary: 'local first', isDefault: true },
      { id: 'image-best', displayName: 'Best', summary: 'runway', isDefault: false },
    ])
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${BASE}/v1/models`)
    expect(headersOf(init).Authorization).toBe(`Bearer ${LOGIN}`)
  })

  it('caches for about a minute, then fetches again on demand', async () => {
    vi.useFakeTimers()
    try {
      fetchMock.mockImplementation(
        async () => new Response(JSON.stringify(models), { status: 200 })
      )
      await listImageClasses()
      await listImageClasses()
      expect(fetchMock).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(61_000)
      await listImageClasses()
      expect(fetchMock).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('returns an empty list (and does not cache) when the proxy fails', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await listImageClasses()).toEqual([])

    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 500 }))
    expect(await listImageClasses()).toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    err.mockRestore()
  })

  it('returns an empty list without fetching when not configured', async () => {
    vi.stubEnv('SWITCH_MEDIA_LOGIN', '')
    expect(await listImageClasses()).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
    const status = await getImageClassStatus()
    expect(status).toEqual({
      imageClasses: [],
      defaultImageClass: DEFAULT_IMAGE_CLASS,
      configured: false,
    })
  })
})

describe('parseImageClassParam', () => {
  it('defaults when absent, trims strings, rejects non-strings', () => {
    expect(parseImageClassParam(undefined)).toEqual({ ok: true, imageClass: DEFAULT_IMAGE_CLASS })
    expect(parseImageClassParam('')).toEqual({ ok: true, imageClass: DEFAULT_IMAGE_CLASS })
    expect(parseImageClassParam(' image-draft ')).toEqual({ ok: true, imageClass: 'image-draft' })
    expect(parseImageClassParam(42)).toEqual({
      ok: false,
      error: 'imageClass must be a non-empty string',
    })
  })
})
