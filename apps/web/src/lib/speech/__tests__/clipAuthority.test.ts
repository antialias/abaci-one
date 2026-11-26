/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest'
import { AUDIO_MANIFEST } from '@/lib/audio/audioManifest'
import { computeClipHash } from '@/lib/audio/clipHash'
import { authorizeClipText } from '../clipAuthority'

describe('authorizeClipText', () => {
  const text = 'Look at the point where the circles cross.'
  const tone = 'Warmly encouraging a young child to explore.'
  const id = computeClipHash({ en: text }, tone)

  it('hash ids: speaks text and tone that hash to the id', () => {
    expect(authorizeClipText(id, text, tone)).toEqual({ ok: true, text, tone })
  })

  it('hash ids: turns away text that does not hash to the id (a sanity check only)', () => {
    expect(authorizeClipText(id, 'Something else.', tone)).toMatchObject({ ok: false, status: 400 })
    expect(authorizeClipText(id, text, 'other tone')).toMatchObject({ ok: false, status: 400 })
  })

  it('hash ids: a missing tone is the empty tone the client hashed with', () => {
    expect(authorizeClipText(computeClipHash({ en: text }, ''), text, undefined)).toMatchObject({
      ok: true,
      tone: '',
    })
  })

  it("manifest ids: speaks the manifest's own text in its own tone", () => {
    const entry = AUDIO_MANIFEST[0]
    expect(authorizeClipText(entry.id, entry.text, 'client tone')).toEqual({
      ok: true,
      text: entry.text,
      tone: entry.tone,
    })
    expect(authorizeClipText(entry.id, 'Rude words.', entry.tone)).toMatchObject({ ok: false })
  })

  it("other named ids: speaks the request's text (storage is keyed by that text)", () => {
    expect(authorizeClipText('my-feature-hello', 'Hello there.', 'warm')).toEqual({
      ok: true,
      text: 'Hello there.',
      tone: 'warm',
    })
  })
})
