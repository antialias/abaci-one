/**
 * @vitest-environment node
 */

import { randomBytes } from 'node:crypto'
import sharp from 'sharp'
import { describe, expect, it } from 'vitest'
import { LLM_IMAGE_MAX_BYTES, LLM_IMAGE_MAX_EDGE, prepareImageForLlm } from '../llm-image'

const decode = (dataUrl: string) => {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl)
  if (!match) throw new Error(`not a data URL: ${dataUrl.slice(0, 40)}`)
  return { type: match[1], bytes: Buffer.from(match[2], 'base64') }
}

describe('prepareImageForLlm', () => {
  it('passes a small image through, typed by its bytes', async () => {
    const png = await sharp({
      create: { width: 40, height: 30, channels: 3, background: '#336699' },
    })
      .png()
      .toBuffer()
    const out = decode(await prepareImageForLlm(`data:image/jpeg;base64,${png.toString('base64')}`))
    expect(out.type).toBe('image/png')
    expect(out.bytes.equals(png)).toBe(true)
  })

  it('scales a large photo to the long edge the API works at', async () => {
    const photo = await sharp({
      create: { width: 4000, height: 3000, channels: 3, background: '#808080' },
    })
      .jpeg({ quality: 95 })
      .toBuffer()
    const out = decode(await prepareImageForLlm(photo))
    expect(out.type).toBe('image/jpeg')
    const meta = await sharp(out.bytes).metadata()
    expect(Math.max(meta.width ?? 0, meta.height ?? 0)).toBe(LLM_IMAGE_MAX_EDGE)
    expect(out.bytes.length).toBeLessThanOrEqual(LLM_IMAGE_MAX_BYTES)
  })

  it('brings a photo over the byte limit under it', async () => {
    // Random pixels do not compress: about 12 MB of PNG at 2000×2000.
    const noise = randomBytes(2000 * 2000 * 3)
    const big = await sharp(noise, { raw: { width: 2000, height: 2000, channels: 3 } })
      .png()
      .toBuffer()
    expect(big.length).toBeGreaterThan(LLM_IMAGE_MAX_BYTES)
    const out = decode(await prepareImageForLlm(big))
    expect(out.bytes.length).toBeLessThanOrEqual(LLM_IMAGE_MAX_BYTES)
  })

  it('keeps transparency as PNG', async () => {
    const shot = await sharp({
      create: {
        width: 2400,
        height: 1600,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .png()
      .toBuffer()
    const out = decode(await prepareImageForLlm(shot))
    expect(out.type).toBe('image/png')
  })

  it('leaves a non-data URL for the provider to judge', async () => {
    expect(await prepareImageForLlm('https://example.com/a.png')).toBe('https://example.com/a.png')
  })
})
