/**
 * @vitest-environment node
 */
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db', () => ({ db: {} }))

import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'
import { computeClipHash } from '@/lib/audio/clipHash'
import { authorizeClipText, type CollectedClipLookup } from '../clipAuthority'

const noCollected: CollectedClipLookup = async () => null

describe('authorizeClipText — hash ids', () => {
  const text = 'Look at the point where the circles cross.'
  const tone = 'Warmly encouraging a young child to explore.'
  const id = computeClipHash({ en: text }, tone)

  it('speaks text and tone that hash to the id', async () => {
    expect(await authorizeClipText(id, text, tone, noCollected)).toEqual({ ok: true, text, tone })
  })

  it('refuses other words under the id', async () => {
    const r = await authorizeClipText(id, 'Something rude.', tone, noCollected)
    expect(r).toMatchObject({ ok: false, status: 400 })
  })

  it('refuses a different tone under the id', async () => {
    const r = await authorizeClipText(id, text, '[whispers] creepy', noCollected)
    expect(r).toMatchObject({ ok: false, status: 400 })
  })

  it('treats a missing tone as the empty tone the client hashed with', async () => {
    const bare = computeClipHash({ en: text }, '')
    expect(await authorizeClipText(bare, text, undefined, noCollected)).toMatchObject({ ok: true })
  })
})

describe('authorizeClipText — named ids', () => {
  const entry = AUDIO_MANIFEST[0]

  it("speaks a manifest clip's own text, in its own tone", async () => {
    const r = await authorizeClipText(entry.id, entry.text, 'ignored-client-tone', noCollected)
    expect(r).toEqual({ ok: true, text: entry.text, tone: entry.tone })
  })

  it('refuses a manifest id with other words', async () => {
    const r = await authorizeClipText(entry.id, 'Something else.', entry.tone, noCollected)
    expect(r).toMatchObject({ ok: false, status: 400 })
  })

  it("speaks a collected clip's server text, in the server's tone", async () => {
    const lookup = vi.fn(async (_clipId: string) => ({
      text: 'Well done!',
      tone: 'celebration',
    }))
    const r = await authorizeClipText('my-feature-done', 'Well done!', 'other', lookup)
    expect(lookup).toHaveBeenCalledWith('my-feature-done')
    expect(r).toEqual({ ok: true, text: 'Well done!', tone: 'celebration' })
  })

  it('refuses a collected id with other words', async () => {
    const lookup: CollectedClipLookup = async () => ({ text: 'Well done!', tone: 'celebration' })
    expect(await authorizeClipText('my-feature-done', 'Nope.', '', lookup)).toMatchObject({
      ok: false,
      status: 400,
    })
  })

  it('refuses an id the server has never seen', async () => {
    expect(await authorizeClipText('made-up-id', 'Anything.', '', noCollected)).toMatchObject({
      ok: false,
      status: 404,
    })
  })
})
